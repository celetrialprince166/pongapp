# pongapp benchmark — documentation index

Teaching-quality, reproducible chapters for the **pongapp** ECS-vs-EKS benchmark:
deploy the same 4-tier app (Angular/nginx + Django/daphne + Postgres + Redis) to
both **Amazon ECS (Fargate)** and **Amazon EKS**, prove each works and self-heals,
and produce a CTO-grade recommendation.

The tutorial chapters live in the repo-root [`docs/`](../../docs/) folder (where
Phases 1–3 were authored); this page is the benchmark-area index pointing at them.
Each chapter follows the same shape: **Goal → Prerequisites → Concepts (the why) →
Steps → Verification → Troubleshooting → Cost & teardown → Key takeaways.**

## Chapters (read in order)

| # | Phase | Chapter | Status |
|---|-------|---------|--------|
| 1 | Containerize & verify locally | *(completed earlier — Dockerfiles + compose)* | ✅ |
| 2 | Terraform infrastructure | [`docs/02-terraform-infrastructure.md`](../../docs/02-terraform-infrastructure.md) | ✅ |
| 3 | ECS deploy + CI/CD | [`docs/03-ecs-deploy-and-cicd.md`](../../docs/03-ecs-deploy-and-cicd.md) | ✅ |
| 4 | **EKS deploy** | [`docs/04-eks-deploy.md`](../../docs/04-eks-deploy.md) | ✅ **new** |
| 5 | Resiliency | [`docs/05-resiliency.md`](../../docs/05-resiliency.md) | ✅ ECS + EKS (kill/self-heal proven on both; side-by-side comparison) |
| 6 | **Benchmark report + walkthrough** | [`benchmark-report.md`](benchmark-report.md) · [`walkthrough-script.md`](walkthrough-script.md) | ✅ **new** |

## The live apps

- **ECS:** http://pongapp-prod-alb-734452423.eu-west-1.elb.amazonaws.com
- **EKS:** http://k8s-tableten-tableten-c826de7545-1164979244.eu-west-1.elb.amazonaws.com

Both answer `/` (Angular SPA, 200) and `/api/health/` (`{"status":"healthy"}`, 200).

## Evidence / assets

Phase 4 capture assets live in [`assets/`](assets/) (and are mirrored into
[`docs/assets/`](../../docs/assets/) so the chapters' relative `assets/…` links
resolve):

- `p4-eks-app-live-01.png` — the login page served live through the EKS ALB.
- `p4-eks-kubectl-evidence-02.png` — nodes Ready, pods Running, Ingress ALB address,
  StorageClasses, the four addons, and curl HTTP 200.
- `p4-eks-cluster-console-03.png` — EKS console: cluster Active (k8s 1.32), Compute tab.
- `p4-eks-nodegroup-console-04.png` — managed node group Active, 2× t3.medium both Ready.
- `p4-eks-alb-targets-console-05.png` — backend ALB target group, 1 healthy / 0 unhealthy.

Phase 5 capture assets:

- `p5-ecs-resiliency-events.png` — ECS service Events showing it replacing a killed task.
- `p5-eks-resiliency-01.png` — EKS results table: three kills (frontend / backend /
  postgres-0), recovery times, per-kill user impact, and the 240-sample availability bar.

## Cost & teardown reminder

Each stack bills ~**$2.50–$3.00/day** and they run **independently** — don't leave
both up. Teardown:

```bash
terraform -chdir=infra/terraform/envs/prod-ecs destroy
# EKS: helm uninstall the ALB controller, terraform destroy, then delete the
# Retain'd Postgres EBS volume by hand (see docs/04-eks-deploy.md).
terraform -chdir=infra/terraform/envs/prod-eks destroy
```
