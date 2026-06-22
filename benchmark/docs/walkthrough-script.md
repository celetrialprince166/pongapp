# pongapp — live walkthrough script (ECS vs EKS demo)

> Rehearsable running order for a ~15-minute live demo. Everything below is a real,
> copy-pasteable command against the deployed stacks. Have two terminals + a browser
> ready. Region `eu-west-1` throughout.

## 0. Before you start (pre-flight, do off-camera)
```bash
# point kubectl at EKS
aws eks update-kubeconfig --name pongapp-prod --region eu-west-1
kubectl get nodes            # expect 2 Ready
kubectl get pods -n table-tennis   # expect all Running

# hold the live URLs handy
EKS_ALB=k8s-tableten-tableten-c826de7545-1164979244.eu-west-1.elb.amazonaws.com
# ECS_ALB=<from: terraform -chdir=infra/terraform/envs/prod-ecs output -raw alb_dns_name>
```

## 1. The story in one sentence (30s)
"Same 4-tier app, deployed two ways — ECS Fargate and EKS — so we can recommend an
orchestrator on evidence, not opinion."

## 2. Show both apps live (2 min)
- Browser → **EKS ALB URL** → the Welcome/login page renders. *"Angular+nginx front
  end, proxying `/api` to a Django backend, both behind an AWS ALB."*
- Browser → **ECS ALB URL** → same app. *"Identical app, different platform underneath."*
- One curl each to prove the API path:
```bash
curl -s -o /dev/null -w "EKS  /api/health → %{http_code}\n" "http://$EKS_ALB/api/health/"
```

## 3. Architecture at a glance (2 min)
- Open **`docs/infra-explorer.html`** (ECS) and **`docs/eks-explorer.html`** (EKS).
- On the EKS explorer: click the **Terraform module graph** (network → eks-cluster →
  IRSA → EBS addon), then the **command player**, then point at the **failure cards**.
- Key talking point: *"ECS = Cloud Map + task defs; EKS = CoreDNS + the AWS Load
  Balancer Controller turning an Ingress into this ALB."*

## 4. Service discovery + the edge (1 min)
```bash
# EKS: native cluster DNS + the controller-managed ALB
kubectl get ingress,svc -n table-tennis
kubectl -n kube-system get deploy aws-load-balancer-controller   # 2/2
```
*"Frontend finds the backend by DNS name `backend.table-tennis.svc`; on ECS the same
job is done by Cloud Map at `backend.pongapp.local`."*

## 5. THE MONEY SHOT — resiliency / self-healing (5 min)
Terminal A (watch):
```bash
kubectl get pods -n table-tennis -w
```
Terminal B (availability monitor — keep it scrolling):
```bash
while true; do printf "%s " "$(date +%T)"; \
  curl -s -m3 -o /dev/null -w "%{http_code}\n" "http://$EKS_ALB/api/health/"; sleep 1; done
```
Terminal C (the kills):
```bash
# (a) frontend — zero downtime (2 replicas)
kubectl delete pod -n table-tennis -l app=frontend --field-selector status.phase=Running | head -1
# watch ReplicaSet recreate it in ~10s; monitor stays 200

# (b) stateful — data survives
kubectl exec -n table-tennis postgres-0 -- psql -U ttl_user -d table_tennis_db \
  -c "CREATE TABLE IF NOT EXISTS demo(t timestamptz default now()); INSERT INTO demo DEFAULT VALUES;"
kubectl delete pod postgres-0 -n table-tennis
kubectl rollout status statefulset/postgres -n table-tennis   # ~13s
kubectl exec -n table-tennis postgres-0 -- psql -U ttl_user -d table_tennis_db -c "SELECT count(*) FROM demo;"
# row survived → same EBS volume reattached
```
*"Kill a pod, Kubernetes reconciles it back — same idea as ECS reconciling desired
task count. The StatefulSet kept its identity and its EBS volume, so the data lived."*

> Honest note to say out loud: the **backend is a single replica** (its media/static
> PVCs are ReadWriteOnce EBS), so killing *it* shows a ~3–6s blip — the fix is S3/EFS
> for shared storage so it can run ≥2 replicas.

## 6. The recommendation (2 min)
Open **`benchmark/docs/benchmark-report.md`** → show the **scored matrix** and the TL;DR.
- *"For one app on a small AWS team: **ECS Fargate** — cheaper (no control-plane fee,
  no idle nodes), far less ops, zero platform failures in the build."*
- *"Flip to **EKS** when portability, fleet scale, or existing Kubernetes skills
  dominate — then its higher scalability/portability scores win the weighting."*

## 7. Cost + responsible teardown (1 min)
```bash
# EKS idle floor ≈ $194/mo (control plane + 2 nodes + NAT + ALB) vs ECS ≈ $53/mo
helm uninstall aws-load-balancer-controller -n kube-system
terraform -chdir=infra/terraform/envs/prod-eks destroy
# then delete the Retain'd Postgres EBS volume by hand
terraform -chdir=infra/terraform/envs/prod-ecs destroy
```
*"Both stacks have a clean teardown — important, because an idle EKS cluster still bills."*

---

### Backup answers (likely Q&A)
- **"Why did EKS take longer to stand up?"** Four real failures: CNI install ordering
  (`before_compute`), PodSecurity restricted, the nginx resolver placeholder, and the
  ALB health-check path. All documented in `docs/04-eks-deploy.md`.
- **"Is the cost comparison fair given different data tiers?"** The report isolates
  orchestration cost from data-tier cost precisely because ECS used managed RDS/ElastiCache
  while EKS self-hosted the DB — that divergence is itself a documented dimension.
- **"Could EKS also be zero-downtime on the backend?"** Yes — move media/static to S3
  (`USE_S3`) or EFS RWX so the backend can run ≥2 replicas.
