# pongapp — ECS Benchmark Documentation

Teaching-quality, reproducible chapters for the **pongapp** DevOps benchmark:
deploy the same 4-tier app (Angular/nginx + Django/daphne + Postgres + Redis) to
Amazon ECS (and later EKS), prove it works, and explain every choice.

Each chapter follows the same shape: **Goal → Prerequisites → Concepts (the why)
→ Steps → Verification → Troubleshooting → Cost & teardown → Key takeaways.**
Follow a chapter top to bottom and you should reproduce the same result.

## Chapters (read in order)

| # | Chapter | What it covers |
|---|---------|----------------|
| 1 | Containerize & verify locally | Dockerfiles + `docker-compose`; the app running on a laptop. *(Phase 1 — completed earlier.)* |
| 2 | [Terraform infrastructure](02-terraform-infrastructure.md) | Provisioning the full ECS stack as code: VPC, ECR, secrets, RDS, ElastiCache, Cloud Map, ALB, Fargate cluster, and keyless-OIDC IAM. |
| 3 | [ECS deploy + CI/CD](03-ecs-deploy-and-cicd.md) | GitHub Actions pipeline, the blue/green go-live, and the two real bugs we hit and fixed. |
| 4 | [EKS deploy](04-eks-deploy.md) | The same app on Amazon EKS: split Terraform roots, ALB Controller, EBS CSI/IRSA, and the node-group + app bugs we hit. |
| 5 | [Resiliency](05-resiliency.md) | Kill tasks/pods on **both** platforms and prove self-healing: ECS desired-count vs EKS ReplicaSet/StatefulSet, with a side-by-side comparison and the health-check bug it surfaced. ✅ ECS + EKS |

> **New in this round:** chapter **05 (Resiliency)** is now complete for **both**
> ECS and EKS. The app self-heals on each orchestrator; the chapter measures
> recovery times and user impact for three EKS kills (frontend, backend,
> Postgres StatefulSet) and compares them side-by-side with the ECS results.
> Next up: Phase 6 — the CTO-grade benchmark report and live walkthrough.

## The live app

**ECS:** http://pongapp-prod-alb-734452423.eu-west-1.elb.amazonaws.com
**EKS:** http://k8s-tableten-tableten-c826de7545-1164979244.eu-west-1.elb.amazonaws.com

- `/` — the Angular SPA, served by the nginx frontend tasks/pods
- `/api/health/` — `{"status":"healthy"}`, proxied through nginx to the Django
  backend (via Cloud Map on ECS, via CoreDNS on EKS)

## Reference material

- **Architecture diagram:** [`architecture/ecs.png`](architecture/ecs.png)
- **Interactive infra explorer:** [`infra-explorer.html`](infra-explorer.html)
- **How it works (deep dive):** [`HOW-IT-WORKS.md`](HOW-IT-WORKS.md)
- **K8s migration roadmap:** [`K8s-MIGRATION-ROADMAP.md`](K8s-MIGRATION-ROADMAP.md)
- **Screenshots / evidence:** [`assets/`](assets/)

## Cost & teardown reminder

Each stack runs roughly **$2.50–$3.00/day** and they bill **independently** — don't
leave both up. When you're done:

```bash
# ECS
terraform -chdir=infra/terraform/envs/prod-ecs destroy

# EKS (also: helm uninstall the ALB controller first, then delete the Retain'd
# Postgres EBS volume by hand — see chapter 04)
terraform -chdir=infra/terraform/envs/prod-eks destroy
```
