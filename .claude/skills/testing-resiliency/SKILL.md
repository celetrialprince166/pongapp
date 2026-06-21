---
name: testing-resiliency
description: Demonstrates and documents automatic self-healing on both ECS Fargate and EKS — kills a running task or pod and proves the orchestrator restarts it with no lasting outage. Use when designing or running any failure, chaos, or resiliency test, when killing a container/pod on purpose, or when measuring recovery time. Phase 5 of the benchmark; produces side-by-side recovery evidence.
---

# Testing resiliency

Phase 5. The brief requires: "manually kill a container/pod in both environments
and demonstrate the application recovers automatically." Do it identically on both
platforms and capture the recovery so the comparison is apples-to-apples.

## Method (run on ECS, then EKS)
The strongest demo records: (1) healthy state, (2) the kill, (3) the orchestrator
replacing it, (4) healthy state again, ideally with the app staying reachable.

### EKS
```bash
kubectl get pods -n pongapp -w        # terminal A: watch
kubectl delete pod <backend-pod> -n pongapp   # terminal B: kill
# Observe ReplicaSet create a replacement; app stays up if replicas >= 2.
```

### ECS (Fargate)
```bash
aws ecs list-tasks --cluster pongapp --service-name pongapp-backend
aws ecs stop-task --cluster pongapp --task <task-id>
# Observe the service launch a replacement task to meet desired count.
```

## What to measure (feeds benchmarking-orchestrators)
- Detection + replacement time (kill → new instance Running/Ready).
- Did end-user traffic drop? (curl the ALB in a loop during the kill.)
- How recovery is expressed: ECS *desired count* reconciliation vs K8s
  *ReplicaSet* reconciliation. Note the conceptual parallel in the report.

## Workflow
```
- [ ] 1. Ensure ≥2 replicas/desired count for the tier under test.
- [ ] 2. Start a loop curl against the ALB to track availability.
- [ ] 3. Kill the pod (EKS), capture before/during/after.
- [ ] 4. Kill the task (ECS), capture before/during/after.
- [ ] 5. Record recovery times + whether traffic dropped.
- [ ] 6. Capture a short screen recording / screenshots (capturing-screenshots).
- [ ] 7. Write the resiliency chapter side-by-side (writing-tutorials).
```

## Tip
For the cleanest demo also kill a **stateful** pod/task (Postgres) once to show
the volume re-attaches and data survives — and note any difference in behavior
between EBS-backed StatefulSet (EKS) and the ECS approach.

## Done when
Both platforms have been shown self-healing with timed, captured evidence and a
side-by-side writeup.
