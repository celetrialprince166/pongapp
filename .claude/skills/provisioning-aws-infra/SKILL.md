---
name: provisioning-aws-infra
description: Provisions shared AWS infrastructure for the pongapp benchmark with Terraform — VPC, public/private subnets, NAT, security groups, ECR, plus the ECS cluster and the EKS cluster. Use when writing or editing any .tf file, setting up remote state, designing the network, or standing up either cluster. Enforces a modular layout, remote S3+DynamoDB state, least-privilege IAM, and a clean teardown path.
---

# Provisioning AWS infra (Terraform)

Phase 2. One shared network hosts BOTH orchestrators so the benchmark is fair.

## Layout
```
benchmark/terraform/
├── modules/
│   ├── network/      # VPC, subnets (public+private), IGW, NAT, route tables
│   ├── ecr/          # one repo per image
│   ├── ecs-cluster/  # ECS cluster + Cloud Map namespace + execution roles
│   └── eks-cluster/  # EKS control plane, node group/Fargate profile, OIDC, addons
└── envs/
    └── dev/          # main.tf wiring modules + backend.tf + terraform.tfvars
```

## Principles
- **Remote state first.** S3 bucket (versioned) + DynamoDB lock table. Configure
  `backend.tf` before applying anything else.
- **Reuse, don't reinvent.** Prefer `terraform-aws-modules/vpc`, `.../ecs`,
  `.../eks` over hand-rolled resources; wrap them in the local modules above.
- **Shared network.** ECS services and EKS nodes both live in the same private
  subnets; only ALBs sit in public subnets.
- **Least privilege.** Scope IAM roles/policies to exactly what each service needs
  (task execution role, EKS node role, IRSA for the LB controller + EBS CSI).
- **Tag everything** `Project=pongapp`, `ManagedBy=terraform`, `Env=dev`.
- **Cost guard.** A single NAT gateway for dev; note hourly costs in output.

## Workflow
```
- [ ] 1. Create S3 state bucket + DynamoDB lock table (one-time bootstrap).
- [ ] 2. Write modules/network; `terraform plan` and review subnet CIDRs.
- [ ] 3. Add modules/ecr; outputs feed containerizing-services.
- [ ] 4. Add modules/ecs-cluster (cluster + Cloud Map namespace).
- [ ] 5. Add modules/eks-cluster (control plane + nodes + OIDC + core addons).
- [ ] 6. `terraform apply`; capture outputs (cluster names, subnet ids, ALB sg).
- [ ] 7. Capture plan/apply + AWS console (triggers capturing-screenshots).
- [ ] 8. Document cost + topology with a diagram (triggers writing-tutorials).
```

## Feedback loop
Always `terraform fmt` + `terraform validate` + `terraform plan` before `apply`.
Never apply on a dirty plan you don't understand. Read the EKS addon docs via
Context7 if versions are unclear — do not guess addon versions.

## Teardown (always tell the user)
`terraform destroy` in `envs/dev`. Destroy clusters/NAT/ALBs when not actively
demoing — they bill hourly (EKS control plane ≈ $0.10/hr, NAT ≈ $0.045/hr).

## Done when
`terraform apply` is clean, both clusters exist and are reachable
(`aws ecs list-clusters`, `aws eks update-kubeconfig` + `kubectl get nodes`),
outputs are captured, and the teardown command is documented.
