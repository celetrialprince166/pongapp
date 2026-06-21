---
name: deploying-to-eks
description: Deploys the pongapp stack to Amazon EKS — adapts the existing k8s/ manifests for real EKS using the AWS Load Balancer Controller for Ingress→ALB, the EBS CSI driver + StorageClass for the Postgres StatefulSet, ECR images, IRSA, and native Kubernetes Service discovery. Use when writing or applying EKS manifests, configuring Ingress/ALB, persistent volumes, or troubleshooting pods on EKS. Phase 4 of the benchmark.
---

# Deploying to EKS

Phase 4. Reuse the existing `k8s/` manifest set (namespace, RBAC, resource-quota,
secrets, configmaps, deployments, postgres StatefulSet, redis, ingress) and adapt
it for a real EKS cluster. Mirror the ECS deployment for a fair comparison.

## What changes vs the generic k8s/ manifests
- **Images:** point to ECR SHA tags, not local/Docker Hub tags.
- **Ingress:** use the **AWS Load Balancer Controller** so the Ingress provisions
  an ALB. Annotate `kubernetes.io/ingress.class: alb`,
  `alb.ingress.kubernetes.io/scheme: internet-facing`,
  `alb.ingress.kubernetes.io/target-type: ip`.
- **Storage:** install the **EBS CSI driver** (addon, via IRSA) and a `gp3`
  StorageClass; the Postgres StatefulSet's `volumeClaimTemplates` uses it.
- **Service discovery:** native ClusterIP Services + DNS
  (`backend.pongapp.svc.cluster.local`) — no Cloud Map needed.
- **IRSA:** service accounts for the LB controller and EBS CSI get scoped IAM roles.

## Architecture note for the report
Running Postgres in-cluster on EBS is fine for this benchmark, but call out that
**Amazon RDS** is the production-grade choice (managed backups, failover, patching).

## Workflow
```
- [ ] 1. update-kubeconfig; confirm nodes Ready.
- [ ] 2. Install AWS Load Balancer Controller (Helm) with IRSA.
- [ ] 3. Install/confirm EBS CSI addon + gp3 StorageClass.
- [ ] 4. kubectl apply namespace, rbac, quota, secrets, configmaps.
- [ ] 5. apply postgres StatefulSet + redis, confirm PVC bound.
- [ ] 6. apply backend + frontend deployments + services.
- [ ] 7. apply Ingress; wait for ALB; verify app via ALB hostname.
- [ ] 8. Capture: kubectl get all, PVC bound, ingress ADDRESS, app in browser.
- [ ] 9. Document differences vs ECS (triggers writing-tutorials).
```

## Feedback loop
`kubectl get pods -w`; for a stuck pod use `kubectl describe pod` +
`kubectl logs`. PVC Pending → check EBS CSI addon + StorageClass. Ingress with no
ADDRESS → check LB controller logs and IRSA permissions. Fix root cause.

## Teardown
`kubectl delete -f` the app + ingress (deletes the ALB), then destroy the cluster
via `provisioning-aws-infra` teardown. Orphaned ALBs/EBS volumes bill — verify
they're gone in the console.

## Done when
App is reachable via the Ingress ALB, Postgres data persists across a pod restart,
manifests are committed, and the ECS-vs-EKS differences are captured.
