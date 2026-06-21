# Phase 5 — Resiliency: prove the app self-heals (ECS)

## Goal

Satisfy the brief's requirement: **manually kill a running container/task and show
the application recovers automatically.** On ECS that means killing a Fargate task
and watching the service reconcile back to its desired count — while the app keeps
serving traffic. (The EKS half — `kubectl delete pod` — comes after Phase 4.)

## Prerequisites

- The ECS stack from Phases 2–3 is deployed and healthy.
- Backend service `pongapp-prod-backend` at desired count **2**.
- The live ALB URL: `http://pongapp-prod-alb-734452423.eu-west-1.elb.amazonaws.com`

## Concepts (the "why")

ECS services are **declarative**: you tell ECS "I want 2 backend tasks," and the
service scheduler continuously reconciles reality toward that. Kill a task and ECS
notices the gap and launches a replacement — no human, no script.

The interesting question is whether *users* notice. Two things keep the app up
during the gap:

1. **Two tasks, not one.** With desired count 2, killing one leaves a healthy
   sibling still serving.
2. **The frontend re-resolves the backend.** nginx looks up `backend.pongapp.local`
   through the VPC resolver every 10s (the fix from Phase 3). When a backend task
   dies, Cloud Map drops its IP and nginx stops sending traffic there — instead of
   caching the dead IP and returning 502s. This is exactly why that fix mattered.

## Steps

A small harness (`scratchpad/resiliency-ecs.sh`) does three things at once: polls
`/api/health/` through the ALB every second, kills one backend task, and times how
long ECS takes to get back to 2 running.

```bash
# pick a victim task
VICTIM=$(aws ecs list-tasks --cluster pongapp-prod-cluster \
  --service-name pongapp-prod-backend --query 'taskArns[0]' --output text)

# (availability monitor runs in the background hitting /api/health/ every 1s)

# kill it
aws ecs stop-task --cluster pongapp-prod-cluster --task "$VICTIM" \
  --reason "Phase 5 resiliency demo"
```

## Verification — the result

```
Killed backend task at 14:25:10
Availability during kill + recovery:  90/90 health checks = HTTP 200   (0 non-200)
ECS recovered to 2 running tasks in 140s (replacement launched, victim gone)
```

**Zero downtime.** Every one of the 90 one-second health probes through the ALB
returned 200 while ECS killed and replaced the task. The service scheduler launched
a fresh Fargate task automatically and the surviving task carried the load.

The service **Events** tab tells the same story from ECS's side — *"Amazon ECS
replaced 1 task due to an unhealthy status"* / *"has started 1 task"*:

![ECS auto-recovery — service events replacing tasks](assets/p5-ecs-resiliency-events.png)

## Troubleshooting — a real bug this demo surfaced

Watching the events, backend tasks were being replaced **continuously** (every few
minutes), not just the one I killed — each with *"failed container health checks"*.

**Root cause:** the backend container health check probed with `wget`, but the
backend image is `python:3.12-slim`, which **does not ship wget** (only the
frontend's `nginx:alpine` does). So the health-check command failed on *every*
backend task regardless of whether daphne was actually healthy — ECS dutifully
killed and replaced "unhealthy" tasks forever. The app still served (daphne was
fine, and there was always ≥1 task plus the resolver), which is why it showed as
zero-downtime churn rather than an outage.

**Fix:** probe with Python's standard library, which is guaranteed present in the
image (`infra/terraform/envs/prod/main.tf`):

```hcl
health_check_command = ["CMD-SHELL",
  "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=4)\" || exit 1"]
```

After `terraform apply` + `aws ecs update-service` (task definition `:4`), backend
tasks pass their health checks and stay running — the flapping stops. Lesson:
**a container health check must use a tool that actually exists in that image.**

## Cost & teardown

This phase adds no new resources. The stack still bills ~$2.50–3/day while up.
Teardown: `cd infra/terraform/envs/prod && terraform destroy`.

## Key takeaways

- ECS service reconciliation replaces a killed task automatically — the declarative
  desired-count model is the resiliency mechanism.
- With 2 tasks + Cloud Map + nginx re-resolution, task loss is **invisible to users**
  (0/90 failed requests here).
- Health checks are only as good as the tool they call — `wget` in a wget-less image
  silently fails every probe. Match the probe to the image.
- **Still to do (EKS half):** repeat with `kubectl delete pod` after Phase 4, and
  compare ECS desired-count reconciliation vs Kubernetes ReplicaSet reconciliation.
