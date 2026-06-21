---
name: deploying-to-ecs-fargate
description: Deploys the pongapp stack to Amazon ECS on Fargate — task definitions, ECS services, AWS Cloud Map service discovery for internal frontend→backend traffic, and a public Application Load Balancer for the frontend edge. Use when creating ECS task definitions or services, wiring Cloud Map or target groups, configuring the ECS ALB, or troubleshooting Fargate task health. Phase 3 of the benchmark.
---

# Deploying to ECS (Fargate)

Phase 3. Deploy the same images to ECS Fargate with correct service discovery and
load balancing, mirroring the EKS deployment for a fair comparison.

## Architecture decisions (state these in the docs)
- **Internal traffic → AWS Cloud Map (service discovery), not internal ALBs.**
  Frontend reaches backend at `backend.pongapp.local` via Cloud Map DNS. Rationale:
  lower latency and no per-LB hourly cost for east-west traffic. Internal ALBs only
  if advanced routing/sticky sessions are needed (they are not here).
- **Public edge → one public ALB** in front of the frontend service only.
- **Fargate launch type**, awsvpc networking, tasks in private subnets.
- **Redis/Postgres** run as Fargate services with Cloud Map names too (note in the
  benchmark report that managed ElastiCache/RDS is the prod-grade alternative).

## Components per tier
- Task definition (CPU/mem, container def, ECR image SHA, log config → CloudWatch,
  secrets from SSM/Secrets Manager, healthCheck).
- ECS service (desired count ≥2 for stateless tiers, Cloud Map registration,
  ALB target group attach for frontend only).
- Security groups: ALB→frontend:80, frontend→backend:8000, backend→redis/postgres.

## Workflow
```
- [ ] 1. Cloud Map namespace pongapp.local (from ecs-cluster module) confirmed.
- [ ] 2. Task def + service for postgres, then redis (with Cloud Map names).
- [ ] 3. Task def + service for backend (Cloud Map: backend.pongapp.local).
- [ ] 4. Task def + service for frontend (Cloud Map + public ALB target group).
- [ ] 5. Inject REDIS_HOST/DB_HOST/etc. as the Cloud Map DNS names.
- [ ] 6. Verify: ALB DNS serves the app; frontend talks to backend; data persists.
- [ ] 7. Capture console: services running, ALB target health, app via ALB URL.
- [ ] 8. Document the Cloud Map vs ALB decision (triggers writing-tutorials).
```

## Define ECS resources in Terraform
Keep ECS task defs/services in `benchmark/terraform` (or `benchmark/ecs/` as JSON
task defs referenced by TF). Do not click-create in the console except to verify.

## Feedback loop
If a task won't stay healthy: check **Stopped reason** + CloudWatch logs, confirm
the security group path, confirm the image SHA exists in ECR, confirm the health
check path returns 200. Fix the root cause; don't just bump desired count.

## Teardown
Set service desired counts to 0, delete services, then task defs deregister with
`terraform destroy`. The public ALB bills hourly — destroy when not demoing.

## Done when
App is reachable via the ALB URL, frontend↔backend works over Cloud Map, the
deployment is in Terraform, and evidence + the architecture rationale are captured.
