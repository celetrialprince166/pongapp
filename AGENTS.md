# AGENTS.md — pongapp

> Operating contract for any AI agent working in this repo. Read this first, then
> let the **skills** do the heavy lifting. You should rarely need a human to tell
> you which skill to use — the routing table below tells you when each one fires.

---

## 1. What this project is

**pongapp** is a real 4-tier web application used as the subject of a DevOps
benchmark: **deploy the same app to both Amazon ECS (Fargate) and Amazon EKS**,
implement service discovery + load balancing in each, prove auto-recovery, and
produce a CTO-grade recommendation on which orchestrator suits the company.

| Tier | Component | Tech | Local port |
|------|-----------|------|-----------|
| Frontend | `Table-Tennis-Frontend/` | Angular built + served by **nginx** | 80 |
| Backend API | `Table-Tennis-Backend/` | **Django / Python** (gunicorn) | 8000 |
| Cache | redis | Redis 7 | 6379 |
| Database | postgres | PostgreSQL | 5432 |

The app already has: working Dockerfiles, `docker-compose.yml`, and a full
Kubernetes manifest set under `k8s/`. The benchmark adds: Terraform IaC, an ECS
Fargate deployment, an EKS deployment, resiliency demos, and documentation.

**"ShopNow" in the original brief is a placeholder — this app IS the subject.**

---

## 2. Prime directives

1. **Document as you build, not after.** Every meaningful step produces evidence
   (a screenshot or captured command output) and a section in the tutorial. The
   submission is *documentation + a live walkthrough* — treat docs as a
   first-class deliverable, never an afterthought. See `writing-tutorials` and
   `capturing-screenshots`.
2. **Skills are automatic.** Match your current task against the routing table
   (§4) and invoke the skill yourself. Do not wait to be told.
3. **Parity between platforms.** Anything done on ECS must have an EKS equivalent
   and vice-versa, so the benchmark is fair. Track both in the same doc.
4. **Cost-aware and reversible.** These clusters cost money idle. Always provide a
   teardown path (`terraform destroy`, `kubectl delete`, `aws ecs ...`) and remind
   the user to run it. Never leave NAT gateways / clusters / LBs running silently.
5. **Secure by default.** No plaintext secrets in git. Use `.env.example`,
   AWS Secrets Manager / SSM Parameter Store, and K8s Secrets. Least-privilege IAM.
6. **Explain the "why".** This project is also for the user to *learn*. When you
   make an architectural choice, state the trade-off in one or two sentences.

---

## 3. Roadmap (the benchmark arc)

Agents should know where any task sits in this arc. Each phase ends with docs +
screenshots committed.

| # | Phase | Primary skill(s) | Status |
|---|-------|------------------|--------|
| 0 | Framework: AGENTS.md + skills + agents | — | ✅ done |
| 0.5 | Monorepo restructure (apps/ + docs/, fresh git) | — | ✅ done |
| 1 | Containerize & verify locally (compose) | `containerizing-services` | ✅ done |
| 2 | Terraform: VPC + ECS cluster (EKS later) | `provisioning-aws-infra` | 🔜 next |
| 3 | ECS Fargate deploy (Cloud Map + ALB) | `deploying-to-ecs-fargate` | ⬜ |
| 4 | EKS deploy (ALB Controller + EBS CSI) | `deploying-to-eks` | ⬜ |
| 5 | Resiliency: kill task/pod, prove recovery | `testing-resiliency` | ⬜ |
| 6 | Benchmark report + live-walkthrough script | `benchmarking-orchestrators` | ⬜ |

---

## 4. Skill routing — invoke these AUTOMATICALLY

When your current work matches the **trigger**, load and follow that skill without
being asked. If two apply, the more specific one wins; chain them when needed
(e.g. any deploy step also triggers `capturing-screenshots` + `writing-tutorials`).

| If you are… | Use skill |
|-------------|-----------|
| Writing/fixing a Dockerfile, `.dockerignore`, compose, or pushing to ECR; verifying the app runs locally | `containerizing-services` |
| Writing/editing any Terraform (`.tf`), provisioning VPC/subnets/NAT, or standing up an ECS or EKS **cluster** | `provisioning-aws-infra` |
| Creating ECS task definitions/services, Cloud Map, target groups, or the ECS ALB; wiring frontend→backend on ECS | `deploying-to-ecs-fargate` |
| Writing/applying K8s manifests for EKS, AWS Load Balancer Controller, Ingress, EBS CSI, or Postgres StatefulSet on EKS | `deploying-to-eks` |
| Killing a pod/task to demonstrate self-healing, or designing any failure/chaos test | `testing-resiliency` |
| Comparing ECS vs EKS, gathering cost/effort/metrics, or writing the CTO recommendation | `benchmarking-orchestrators` |
| At any step where visual proof helps — browser UI, AWS console, terminal output, dashboards | `capturing-screenshots` |
| Finishing a phase or any teachable step; producing the end-to-end learning writeup | `writing-tutorials` |

> Rule of thumb: **a deploy/infra action is never "done" until its evidence is
> captured (`capturing-screenshots`) and its narrative is written
> (`writing-tutorials`).** Bake that into every phase.

---

## 5. Subagents — when to delegate

Defined in `.claude/agents/`. Delegate to keep the main context clean and to run
work in parallel.

| Agent | Hand off when… |
|-------|----------------|
| `infra-engineer` | A phase needs focused Terraform / ECS / EKS implementation across many files. |
| `docs-scribe` | A phase is functionally complete and needs screenshots gathered + a tutorial chapter written. Runs *after* infra work, can run in parallel with the next phase's planning. |
| `platform-reviewer` | Before declaring a phase done — reviews IaC/manifests for security, cost, and parity issues. |

Typical loop per phase: **plan → `infra-engineer` builds → `platform-reviewer`
checks → `docs-scribe` documents → commit.**

---

## 6. Repo conventions

- **New benchmark work lives under** `benchmark/` to keep it separate from the
  app code and the existing `k8s/` set:
  - `benchmark/terraform/` — modules + `envs/` roots, S3+DynamoDB remote state
  - `benchmark/ecs/` — task definitions, Cloud Map, ECS-specific assets
  - `benchmark/eks/` — EKS-tuned manifests / kustomize overlays (reuse `k8s/`)
  - `benchmark/docs/` — tutorials, the benchmark report, walkthrough script
  - `benchmark/docs/assets/` — screenshots (see naming in `capturing-screenshots`)
- **Naming:** lowercase-kebab for AWS resources, prefix everything `pongapp-`.
- **Region:** default `eu-west-1` unless the user says otherwise; one region only.
- **Images:** tag with git short SHA, never rely on `:latest` in task defs/manifests.
- **Secrets:** never commit real values. `*.tfvars` with secrets are gitignored.
- **Always offer the teardown command** at the end of any provisioning step.

---

## 7. Definition of done (per phase)

- [ ] It works and was verified (command output / screenshot proves it).
- [ ] ECS and EKS parity maintained (or the gap is documented and justified).
- [ ] Evidence captured to `benchmark/docs/assets/` via `capturing-screenshots`.
- [ ] Tutorial chapter written via `writing-tutorials`, with the "why".
- [ ] `platform-reviewer` pass: no leaked secrets, least-privilege IAM, teardown exists.
- [ ] Teardown path stated to the user.
- [ ] Roadmap table (§3) status updated.
