# Phase 2 — Provisioning the ECS Infrastructure with Terraform

## Goal

Stand up every piece of AWS infrastructure the pongapp ECS deployment needs —
network, container registry, secrets, managed data stores, service discovery, a
public load balancer, the Fargate cluster, and the IAM roles that let GitHub
Actions deploy without static keys — entirely as code. By the end of this chapter
you can run a handful of `terraform` commands from a clean machine and get an
identical, reproducible ECS-ready environment in `eu-west-1`. Nothing here is
clicked in the console.

This is the foundation Phase 3 (the actual deploy + CI/CD) builds on, and it is
one half of the ECS-vs-EKS benchmark — the EKS phase will provision the parallel
equivalent so the two can be compared fairly.

![pongapp ECS architecture — what Phase 2 provisions](assets/p2-ecs-architecture-01.png)

> There's also an interactive version of this diagram at
> [`docs/infra-explorer.html`](infra-explorer.html) — open it in a browser to
> click through each tier.

## Prerequisites

- **Phase 1 done:** the app is containerized and verified locally with
  `docker-compose`. The Dockerfiles under `apps/frontend` and `apps/backend` are
  what we'll later push to ECR.
- **Tooling:** Terraform **>= 1.10.0** (we rely on native S3 state locking, which
  landed in 1.10) and the AWS CLI v2, authenticated to account `648637468459`
  with permission to create the resources below.
- **A GitHub repo** for the app (`github_org`/`github_repo` in `variables.tf`) —
  its identity is what the OIDC trust policy is scoped to.
- **The remote-state S3 bucket must exist** before `terraform init` (see
  Concepts). One-time bootstrap, shown in Step 1.

## Concepts (the "why")

**Remote state in S3 with native locking, no DynamoDB.** Terraform state is the
source of truth for what exists; it has to live somewhere shared and be locked so
two applies can't race. The classic pattern was "S3 for the file + a DynamoDB
table for the lock." As of Terraform 1.10 the S3 backend can lock the state
itself by writing a `<key>.tflock` object next to the state file
(`use_lockfile = true`). DynamoDB-based locking is now deprecated. We use the
native lockfile: one fewer resource to provision, pay for, and reason about, and
no separate table that can drift from the bucket. See `envs/prod/backend.tf`.

**Managed RDS + ElastiCache instead of running Postgres/Redis in the cluster.**
We could run Postgres and Redis as Fargate tasks, but a database that holds real
data wants managed backups, patching, failover, and a stable endpoint — exactly
what RDS and ElastiCache give you. Keeping state out of the orchestrator also
keeps the ECS-vs-EKS comparison honest: both platforms talk to the *same* managed
data tier, so the benchmark measures the orchestrators, not two different
database setups. The trade-off is cost (these run 24/7) and a little less
"everything in one place," which we accept for durability.

**Cloud Map (private DNS) for east-west traffic, not an internal ALB.** The
frontend needs to reach the backend. Two common options: a second, internal ALB,
or DNS-based service discovery. We chose AWS Cloud Map: the backend registers
`backend.pongapp.local` in a private DNS namespace, and the frontend resolves
that name. This avoids a second load balancer's hourly + LCU cost and removes a
network hop (lower latency) for purely internal calls. The trade-off is you don't
get an ALB's richer health-check/routing features internally — fine here, because
ECS already manages task health and Cloud Map only publishes healthy tasks.

**Keyless OIDC for CI/CD.** GitHub Actions assumes IAM roles via OpenID Connect
short-lived tokens — there are **no long-lived AWS access keys** stored in GitHub
secrets to leak or rotate. We provision an OIDC identity provider plus two roles:
a narrow *CI role* (push to ECR) and a *deploy role* (register task defs, run
tasks, update services). Trade-off: slightly more IAM to set up once, in exchange
for removing the single most common cloud credential-leak vector.

**Least-privilege security groups.** Only the ALB's security group is open to the
internet (80/443). The frontend tasks accept traffic only from the ALB SG; the
backend tasks only from the frontend SG; RDS only from the backend SG on 5432;
Redis only from the backend SG on 6379. Each tier can talk to exactly the tier
below it and nothing else — a flat "allow VPC" rule would have been easier but
would let any compromised task reach the database directly.

**Modules, with a reusable `ecs-service`.** Each concern is its own module under
`infra/terraform/modules/`. The interesting one is `ecs-service`: a single module
that renders *either* a blue/green ALB service (frontend) *or* a Cloud Map rolling
service (backend) depending on which inputs you pass. One module, two very
different service shapes — less copy-paste, guaranteed consistency.

## The modules at a glance

All under `infra/terraform/modules/`, wired together in `envs/prod/main.tf`:

| Module | What it creates | Key decision |
|--------|-----------------|--------------|
| `network` | VPC `10.0.0.0/16`, 3 subnet tiers × 2 AZ (public / private-app / private-data), **single** NAT gateway, tiered SGs | One NAT (not one per AZ) to cut ~$32/mo; tiered SGs for least privilege |
| `ecr` | `pongapp-frontend` + `pongapp-backend` repositories | Image scanning on push; SHA tags, never bare `:latest` in task defs |
| `iam-github-oidc` | GitHub OIDC provider + **CI role** | Keyless push to ECR |
| `secrets` | `random_password` → Secrets Manager (DB password, Django secret key) | Secrets generated in TF, never in git |
| `rds` | PostgreSQL **17** on `db.t4g.micro` | Managed, Graviton for price/perf |
| `elasticache` | Redis **7** on `cache.t4g.micro` | Managed cache, Graviton |
| `cloudmap` | Private DNS namespace `pongapp.local` | East-west service discovery |
| `alb` | Public ALB + **blue & green** target groups + production listener rule + ECS blue/green LB role | Native blue/green for the frontend |
| `ecs-cluster` | Fargate cluster (+ Fargate Spot capacity provider) | Serverless containers; Spot for cost |
| `ecs-service` | Reusable service: frontend = blue/green, backend = Cloud Map | One module, two shapes |
| `iam-github-deploy` | **Deploy role** for the pipeline | Least-privilege deploy |

## Steps

### 1. Bootstrap the remote-state bucket (one time)

The S3 backend can't store state in a bucket that doesn't exist yet, so create it
once before the first `init`. Native locking needs nothing else — no DynamoDB
table.

```bash
aws s3api create-bucket \
  --bucket pongapp-tfstate-648637468459-euw1 \
  --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1
aws s3api put-bucket-versioning \
  --bucket pongapp-tfstate-648637468459-euw1 \
  --versioning-configuration Status=Enabled
```

Versioning gives you a recoverable history of state. The backend config that
points at this bucket lives in `infra/terraform/envs/prod/backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket       = "pongapp-tfstate-648637468459-euw1"
    key          = "pongapp/ecs/prod/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true # native S3 state locking (writes <key>.tflock); no DynamoDB
  }
}
```

### 2. `terraform init` — wire up the S3 backend + providers

```bash
cd infra/terraform/envs/prod
terraform init
```

Downloads the AWS provider (`~> 6.0`, required for ECS-native blue/green) and
configures the S3 backend. From here on, state is remote and locked.

### 3. `fmt` + `validate` — cheap correctness checks

```bash
terraform fmt -recursive   # canonical formatting across all modules
terraform validate         # types/refs are internally consistent
```

`fmt` keeps the HCL canonical; `validate` catches reference and type errors
before any API call is made (and before any cost is incurred).

### 4. `terraform plan` — see the whole 78-resource picture

```bash
terraform plan -out=tfplan
```

This prints the full execution plan — roughly **78 resources** for the complete
stack (VPC + subnets + routes + NAT, ECR, OIDC + roles, secrets, RDS,
ElastiCache, Cloud Map, ALB + target groups, the cluster, and both ECS
services). Reading the plan is the moment to sanity-check CIDRs, instance classes,
and that nothing unexpected is being destroyed.

### 5. Staged `apply` — registry + OIDC first, then the rest

We apply in two waves rather than one big bang. The first wave creates just the
ECR repositories and the GitHub OIDC role, so the CI pipeline has somewhere to
push images and an identity to assume *before* the app services (which reference
those images) come up.

```bash
# Wave 1: registry + CI identity
terraform apply -target=module.ecr -target=module.github_oidc

# Wave 2: everything else
terraform apply tfplan
```

> Why staged: the ECS services reference image URLs in ECR. Creating the registry
> and OIDC role first lets you push a first image (Phase 3) and avoids a
> chicken-and-egg ordering problem on a cold environment. After the first run,
> `terraform apply` in one shot is fine.

### 6. Read the outputs you'll need in Phase 3

```bash
terraform output
```

The outputs in `envs/prod/outputs.tf` hand the next phase everything it needs:

| Output | Used for |
|--------|----------|
| `alb_dns_name` | The public app URL |
| `ecr_repository_urls` | Push targets for CI |
| `github_ci_role_arn` / `github_deploy_role_arn` | `role-to-assume` in the workflows |
| `backend_service_discovery_name` | `backend.pongapp.local` — the name nginx proxies to |
| `rds_address` / `redis_endpoint` | Wired into the backend task env |

## Verification

- `terraform validate` returns **"Success! The configuration is valid."**
- `terraform plan` shows **no diff** after a clean apply (idempotent).
- The state lockfile appears/disappears around an apply:
  ```bash
  aws s3 ls s3://pongapp-tfstate-648637468459-euw1/pongapp/ecs/prod/
  # terraform.tfstate   (+ terraform.tfstate.tflock briefly during apply)
  ```
- Console-free spot checks of the actual resources:
  ```bash
  aws ecs describe-clusters --clusters pongapp-prod-cluster \
    --query 'clusters[0].status'                    # ACTIVE
  aws servicediscovery list-namespaces \
    --query "Namespaces[?Name=='pongapp.local'].Id" # the namespace id
  aws elbv2 describe-load-balancers --names pongapp-prod-alb \
    --query 'LoadBalancers[0].DNSName'              # the ALB DNS name
  ```

The app itself isn't live yet — that's Phase 3. Phase 2 is "done" when the
infrastructure exists and `plan` is clean.

## Troubleshooting

**Cloud Map service forces a perpetual replace.** The
`aws_service_discovery_service` carries an empty `health_check_custom_config {}`
block (it tells Cloud Map to use ECS-reported health). The provider can't read
that empty block back cleanly, so every subsequent `plan` wanted to *replace* the
service — and a replace fails while ECS tasks are registered against it. Fix, in
`modules/ecs-service/main.tf`:

```hcl
lifecycle {
  ignore_changes = [health_check_custom_config]
}
```

Create it once, then ignore that attribute. Plans go clean. (This same module
also `ignore_changes = [task_definition]` on the ECS service, because ECS rewrites
the task-def revision on every deploy and we don't want Terraform fighting the
pipeline over it.)

**`Error: error acquiring the state lock`.** Means a previous apply didn't release
the `.tflock` object (e.g. it was killed). Confirm no apply is actually running,
then remove the lock object or `terraform force-unlock <LOCK_ID>`.

## Cost & teardown

Running 24/7 this stack costs roughly **$2.50–$3.00/day**, dominated by the NAT
gateway, the ALB, RDS, ElastiCache, and the Fargate tasks. The single-NAT and
`t4g.micro` choices are deliberate cost controls.

Tear the whole thing down with one command:

```bash
cd infra/terraform/envs/prod
terraform destroy
```

> Note: `destroy` empties and removes the app infra and IAM. The remote-state
> bucket is created out-of-band (Step 1), so it survives `destroy` — delete it
> manually only if you're done with the project entirely.

## Key takeaways

- **Terraform 1.10 native S3 locking** removes the DynamoDB lock table — less to
  provision, less to pay for, nothing to drift.
- **Keep data managed and out of the cluster** (RDS + ElastiCache) for durability
  and a fair ECS-vs-EKS comparison.
- **Cloud Map > internal ALB** for east-west: cheaper, lower-latency service
  discovery via private DNS.
- **Keyless OIDC** means zero static AWS keys in CI — the biggest credential-leak
  risk just disappears.
- **One reusable `ecs-service` module** renders both a blue/green ALB service and a
  Cloud Map rolling service, depending on inputs.
- **Stage the first apply** (registry + OIDC, then the rest) to dodge cold-start
  ordering problems.
