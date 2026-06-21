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

> **New in this round:** chapters **02** and **03**. Phase 1 (local
> containerization) was completed earlier and is referenced for context.

## The live app

**http://pongapp-prod-alb-734452423.eu-west-1.elb.amazonaws.com**

- `/` — the Angular SPA, served by the nginx frontend tasks
- `/api/health/` — `{"status":"healthy"}`, proxied through nginx to the Django
  backend via Cloud Map

## Reference material

- **Architecture diagram:** [`architecture/ecs.png`](architecture/ecs.png)
- **Interactive infra explorer:** [`infra-explorer.html`](infra-explorer.html)
- **How it works (deep dive):** [`HOW-IT-WORKS.md`](HOW-IT-WORKS.md)
- **K8s migration roadmap:** [`K8s-MIGRATION-ROADMAP.md`](K8s-MIGRATION-ROADMAP.md)
- **Screenshots / evidence:** [`assets/`](assets/)

## Cost & teardown reminder

The ECS stack runs ~**$2.50–$3.00/day** (NAT + ALB + RDS + ElastiCache +
Fargate). When you're done:

```bash
cd infra/terraform/envs/prod
terraform destroy
```
