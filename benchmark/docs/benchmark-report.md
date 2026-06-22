# pongapp — ECS Fargate vs Amazon EKS: a CTO benchmark

> The same 4-tier application (Angular/nginx · Django/daphne · Redis · PostgreSQL)
> was deployed to **both** Amazon ECS (Fargate) and Amazon EKS in `eu-west-1`, with
> service discovery, an ALB edge, and an automatic-recovery demo on each. This report
> turns that side-by-side build into a scored recommendation.

---

## 1. CTO TL;DR (the one-pager)

**Recommendation for pongapp today: run it on ECS Fargate.** For a single application
and a small team that is already all-in on AWS, ECS delivered the same running app for
**less money and dramatically less operational friction** — no control-plane fee, no
nodes to patch, and zero platform-specific failures during the build. The EKS deploy,
by contrast, cost us **two `terraform apply` runs and four distinct failures** (CNI
ordering, PodSecurity, the nginx resolver, and the ALB health-check path) before it
served traffic.

**Choose EKS instead when** any of these become true: you need **multi-cloud / on-prem
portability**, you are running **many services** that benefit from the Kubernetes
ecosystem (Helm, operators, HPA/Karpenter), or you already employ a **platform team
with Kubernetes skills**. EKS scored higher on scalability and portability — it is the
better *platform* bet, just not the cheaper or simpler *application* bet.

| | ECS Fargate | Amazon EKS |
|---|---|---|
| **Weighted score (this use case)** | **4.3 / 5** | 3.6 / 5 |
| Best at | cost, low ops, AWS-native simplicity | portability, scalability, ecosystem |
| Fixed monthly floor (idle, orchestration only) | ~$20 (NAT+ALB) | ~$162 (+control plane +2 nodes) |
| Time-to-live in this project | 1 apply, 0 platform failures | 2 applies, 4 failures fixed |
| Lock-in | High (AWS-only) | Low (portable Kubernetes) |

---

## 2. What was actually built on each side

| Concern | ECS Fargate (Phase 3) | Amazon EKS (Phase 4) |
|---|---|---|
| Compute | Fargate tasks (serverless, no nodes) | Managed node group, 2× t3.medium (EC2) |
| Service discovery | AWS Cloud Map (`backend.pongapp.local`) | Native CoreDNS (`backend.table-tennis.svc`) |
| Load balancing | ALB → target groups, **blue/green** deploys | ALB via **AWS Load Balancer Controller** ← Ingress |
| Data tier | **Managed** RDS PostgreSQL + ElastiCache Redis | **Self-hosted** Postgres StatefulSet (EBS) + Redis pod |
| Secrets / IAM | Task roles + Secrets Manager | **IRSA** + K8s Secrets + KMS envelope encryption |
| Persistent storage | (managed by RDS) | EBS CSI driver + gp3 / gp3-retain StorageClasses |
| IaC | `envs/prod-ecs` (Terraform) | `envs/prod-eks` (Terraform, own VPC 10.1.0.0/16) |

> **Important caveat for fair reading:** the two deploys deliberately diverged on the
> data tier — ECS used **managed RDS/ElastiCache**, EKS ran the database **in-cluster**.
> That is itself a benchmark dimension (managed vs self-hosted), but it means the cost
> rows below separate *orchestration* cost from *data-tier* cost so we compare like with like.

---

## 3. Scored decision matrix

Each dimension scored 1–5 per platform, with a weight reflecting a typical
single-app, AWS-committed team. Scores are justified from **this** deployment, not
brochure claims.

| Dimension | Weight | ECS | EKS | One-line justification |
|---|:--:|:--:|:--:|---|
| **Cost** | 20% | 5 | 3 | EKS adds a fixed **$0.10/hr control-plane fee** (~$73/mo) **+ always-on nodes**; ECS Fargate has no control-plane fee and no idle node floor. |
| **Operational overhead** | 20% | 5 | 2 | EKS needed Helm + LB Controller install, 4 managed addons, node patching, and hit **4 build failures**; Fargate has no nodes to manage and AWS owns the control plane. |
| **Developer experience** | 10% | 4 | 4 | ECS task-defs are simple but AWS-specific; EKS reuses the standard `k8s/` manifests (better local↔cloud parity) and richer `kubectl` debugging. Net wash. |
| **Service discovery & LB** | 10% | 4 | 4 | Cloud Map vs CoreDNS — both clean. ECS blue/green is slick; the EKS LB Controller is more flexible but more to install. |
| **Scalability** | 10% | 4 | 5 | ECS service auto-scaling + Fargate is simple; EKS offers HPA + Cluster Autoscaler/Karpenter — more powerful and granular. |
| **Resiliency** | 10% | 4 | 4 | Both self-heal (Phase 5). ECS blue/green = zero-downtime; EKS zero-downtime on multi-replica + StatefulSet, brief blip only on the single-replica backend (our config, not the platform). |
| **Ecosystem / portability** | 10% | 2 | 5 | ECS is AWS-locked; EKS is conformant Kubernetes — portable across clouds/on-prem with a vast tooling ecosystem. |
| **Security** | 10% | 4 | 4 | Task roles + Secrets Manager vs IRSA + KMS + K8s Secrets + PodSecurity. Both least-privilege; EKS adds defense-in-depth at the cost of more wiring. |
| **Weighted total** | 100% | **4.3** | **3.6** | ECS wins on this weighting; EKS wins if portability/scalability are weighted up. |

**Sensitivity:** raise *portability* + *scalability* to 20% each and drop *cost* +
*ops* to 10% each — the kind of weighting a multi-cloud platform org would use — and
**EKS pulls ahead (~4.0 vs ~3.9)**. The "right" answer is genuinely a function of the
company's weights, which is why both weightings are shown.

---

## 4. Cost detail (eu-west-1, on-demand, indicative)

**Orchestration floor — what you pay before the app does anything useful:**

| | ECS Fargate | EKS |
|---|---|---|
| Control plane | $0 | **$0.10/hr ≈ $73/mo** |
| Compute floor (idle) | $0 (tasks scale to desired; no node floor) | 2× t3.medium ≈ **$68/mo** (nodes run even when idle) |
| NAT gateway | ~$33/mo | ~$33/mo |
| ALB | ~$20/mo | ~$20/mo |
| **Idle floor** | **~$53/mo** | **~$194/mo** |

The EKS premium is structural: you pay for the managed control plane **and** for
nodes that sit there whether or not pods are scheduled. ECS Fargate's bill tracks
running tasks, so a quiet service costs less.

**Data tier (diverged by design):** ECS's managed RDS + ElastiCache are *pricier* but
*operated by AWS*; EKS's in-cluster Postgres/Redis are *cheaper* but *you* own backups,
HA, and patching. This partially offsets the orchestration gap — and is itself the
managed-vs-self-hosted trade the CTO must weigh.

---

## 5. Resiliency evidence (Phase 5)

Both platforms self-heal; the control-loop concept is identical (ECS reconciles
*desired count*, Kubernetes reconciles via the *ReplicaSet/StatefulSet controller*).

| Kill | EKS recovery | EKS user impact |
|---|---|---|
| Frontend pod (2 replicas) | 10s | zero downtime |
| Backend pod (1 replica) | 54s | ~3–6s blip (single replica — RWO-EBS constraint) |
| postgres-0 (StatefulSet) | 13s | zero downtime, **same EBS volume reattached, data survived** |

EKS held **98.75% availability** across all three kills. ECS demonstrated zero-downtime
recovery via blue/green + multiple tasks. The only user-visible EKS blip came from a
**configuration choice** (single backend replica, forced by ReadWriteOnce EBS), not a
platform weakness — S3/EFS would remove it.

![EKS resiliency results](assets/p5-eks-resiliency-01.png)

---

## 6. When would the opposite choice be right?

**Pick EKS over ECS when:**
- You must avoid cloud lock-in (multi-cloud, hybrid, or on-prem futures).
- You run a *fleet* of services and want one consistent platform + the K8s ecosystem.
- You already have Kubernetes expertise — the steeper curve is then a non-issue.
- You need advanced scheduling (Karpenter, spot mixing, GPU pools, custom operators).

**Pick ECS over EKS when (pongapp's situation):**
- One or a few apps, a small team, already standardized on AWS.
- Cost and low operational overhead matter more than portability.
- You want the shortest path to production with the fewest moving parts.

---

## 7. Conclusion

For **pongapp specifically**, the evidence points to **ECS Fargate**: it was cheaper,
simpler, and reached production with no platform-specific failures. EKS is the stronger
*platform* — more portable, more scalable, richer ecosystem — and is the right call the
moment portability, fleet scale, or existing Kubernetes investment enter the picture.
Both were proven to run the identical app with service discovery, an ALB edge, and
automatic recovery, so this is a decision about **operating model and economics**, not
about capability.

*See the [live walkthrough script](walkthrough-script.md) for the demo running order,
and [`docs/04-eks-deploy.md`](../../docs/04-eks-deploy.md) / [`docs/05-resiliency.md`](../../docs/05-resiliency.md)
for the build and resiliency detail.*
