---
name: benchmarking-orchestrators
description: Produces the CTO-grade comparison of Amazon ECS (Fargate) vs Amazon EKS for pongapp — gathers cost, operational effort, developer experience, scalability, and resiliency data into a scored decision matrix and a clear recommendation. Use when comparing the two platforms, collecting metrics across phases, or writing the final benchmark report and live-walkthrough script. Phase 6, the headline deliverable.
---

# Benchmarking orchestrators (ECS vs EKS)

Phase 6 and the point of the whole project: a defensible recommendation for the
CTO. Pull evidence gathered across Phases 1–5 into one report.

## Comparison dimensions (score each 1–5, weight per the company's priorities)
| Dimension | What to capture |
|-----------|-----------------|
| Cost | Control plane fee (EKS ≈ $0.10/hr/cluster; ECS none), compute ($/task vs $/node), NAT/ALB, idle cost. Use actual numbers from this deploy. |
| Operational overhead | Setup time, upgrades/patching, addon management, who-manages-what. |
| Developer experience | Manifest/task-def authoring effort, local→cloud parity, debugging. |
| Service discovery & LB | Cloud Map vs K8s DNS; ALB integration on each. |
| Scalability | Autoscaling model (ECS service AS vs HPA/Cluster Autoscaler/Karpenter). |
| Resiliency | Recovery times + behavior from `testing-resiliency`. |
| Ecosystem / portability | AWS lock-in vs Kubernetes portability + tooling. |
| Security | IAM model: task roles vs IRSA; secrets handling. |

## Known baseline facts (verify against this deploy, don't just quote)
- EKS adds a fixed control-plane charge (~$74/mo per cluster); ECS has no such fee.
- Fargate trades ~20–30% compute premium for near-zero node ops on both.
- ECS is simpler + AWS-native; EKS is more flexible + portable with a steeper curve.
- Cloud Map gives low-latency internal discovery without per-LB cost; K8s does this
  natively via cluster DNS.

## Deliverables
1. `benchmark/docs/benchmark-report.md` — matrix, scores, the recommendation, and
   "when would the opposite choice be right?".
2. A one-page decision summary (the CTO TL;DR).
3. `benchmark/docs/walkthrough-script.md` — the live demo running order (what to
   show, in what sequence, with the ALB URLs and kill commands ready).

## Workflow
```
- [ ] 1. Collect per-phase metrics into a table (cost, time, LoC, recovery).
- [ ] 2. Score each dimension with one-line justifications.
- [ ] 3. Write the recommendation + the caveats / "it depends" cases.
- [ ] 4. Assemble the live-walkthrough script.
- [ ] 5. Embed the strongest screenshots (capturing-screenshots).
- [ ] 6. Final pass via writing-tutorials for narrative + diagrams.
```

## Done when
The report has real numbers from this deployment, a scored matrix, an unambiguous
recommendation with trade-offs, and a rehearsable walkthrough script.
