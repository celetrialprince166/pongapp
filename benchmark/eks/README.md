# EKS overlay (benchmark/eks)

Kustomize overlay that adapts the generic `k8s/` manifest set for a real EKS
cluster. It references the base manifests (it does not copy them) and layers on
EKS-specific changes: ECR images, a gp3 EBS StorageClass, an ALB Ingress, and
corrected backend probes.

> Terraform is split into two independent roots so ECS and EKS deploy from the
> same shared modules without conflict:
> `infra/terraform/envs/prod-ecs` (ECS stack, owns the ECR repos + GitHub OIDC
> provider) and `infra/terraform/envs/prod-eks` (this EKS stack, with its own VPC;
> it reads the ECR repos read-only). All `terraform` commands below target
> `prod-eks`.

## Prerequisites (provisioned by Terraform in `infra/terraform/envs/prod-eks`)
- EKS cluster `pongapp-prod`, managed node group Ready.
- `aws-ebs-csi-driver` addon (IRSA-backed) installed.
- AWS Load Balancer Controller IRSA role created (Terraform output
  `aws_lb_controller_role_arn`) — the controller itself is Helm-installed
  post-apply (see below).

## Deploy order (post `terraform apply`)
```sh
# 1. kubeconfig
aws eks update-kubeconfig --name pongapp-prod --region eu-west-1
kubectl get nodes

# 2. AWS Load Balancer Controller (Helm) using the Terraform IRSA role ARN
ROLE_ARN=$(terraform -chdir=infra/terraform/envs/prod-eks output -raw aws_lb_controller_role_arn)
helm repo add eks https://aws.github.io/eks-charts && helm repo update
kubectl apply -k \
  "github.com/aws/eks-charts/stable/aws-load-balancer-controller/crds?ref=master"
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=pongapp-prod \
  --set serviceAccount.create=true \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set "serviceAccount.annotations.eks\.amazonaws\.com/role-arn=$ROLE_ARN" \
  --set region=eu-west-1 \
  --set vpcId=$(terraform -chdir=infra/terraform/envs/prod-eks output -raw vpc_id)

# 3. Secrets are gitignored and must be applied directly from k8s/secrets/:
kubectl apply -f k8s/secrets/db-credentials.yaml -f k8s/secrets/app-secrets.yaml

# 4. The app + EKS-specific resources
kubectl apply -k benchmark/eks

# 5. Set BACKEND_RESOLVER to the CoreDNS ClusterIP (placeholder in the overlay)
CLUSTER_DNS=$(kubectl -n kube-system get svc kube-dns -o jsonpath='{.spec.clusterIP}')
kubectl -n table-tennis set env deployment/frontend BACKEND_RESOLVER=$CLUSTER_DNS

# 6. Get the ALB hostname, then set CSRF/CORS origins to it (same fix as ECS)
kubectl -n table-tennis get ingress table-tennis-ingress \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

## Post-deploy app config (parity with ECS)
The backend's `DJANGO_CSRF_TRUSTED_ORIGINS` / `CORS_ALLOWED_ORIGINS` must include
the ALB URL once it is known (in `k8s/secrets/app-secrets.yaml` /
`k8s/configmaps/env-config.yaml`), then roll the backend:
`kubectl -n table-tennis rollout restart deployment/backend`.

## What this overlay intentionally omits / overrides
- The nginx `k8s/ingress/ingress.yaml` is replaced by `ingress-alb.yaml`. The ALB
  Ingress has NO `/djadmin` rule — Django serves the admin at `/admin/`, and the
  frontend nginx already rewrites `/djadmin/` -> `/admin/`, so `/djadmin` falls
  through to the frontend (routing it straight to the backend would 404).
- The standalone `k8s/postgres/pvc.yaml` (hostpath) is not used; the StatefulSet
  `volumeClaimTemplates` is patched to the `gp3-retain` StorageClass (Retain, so
  the DB volume survives teardown — see Teardown for manual cleanup).
- Backend is patched to `replicas: 1`: its media/static PVCs are ReadWriteOnce
  EBS volumes, which cannot multi-attach across nodes. Restore HA later via S3
  (`USE_S3`) or EFS RWX. ECS keeps `desired_count: 2` behind Cloud Map.
- Images repointed from Docker Hub (`franzjameskaba/ttl-*`) to ECR
  `pongapp-backend` / `pongapp-frontend`. `newTag` is a placeholder (`latest` for a
  manual smoke test); CI stamps the git short SHA, never shipping `:latest`.

## Teardown
```sh
kubectl delete -k benchmark/eks            # deletes the ALB via the Ingress
kubectl delete -f k8s/secrets/db-credentials.yaml -f k8s/secrets/app-secrets.yaml
helm uninstall aws-load-balancer-controller -n kube-system
# then: terraform -chdir=infra/terraform/envs/prod-eks destroy
```

> IMPORTANT — retained DB volume: the Postgres StatefulSet uses the `gp3-retain`
> StorageClass (`reclaimPolicy: Retain`) so `kubectl delete -k` does NOT delete the
> database EBS volume. This is intentional (prevents accidental data loss) but means
> the volume survives teardown and keeps billing. After deleting the namespace,
> find the released volume and delete it manually:
> ```sh
> aws ec2 describe-volumes --region eu-west-1 \
>   --filters Name=tag:kubernetes.io/created-for/pvc/name,Values=postgres-storage-postgres-0 \
>   --query 'Volumes[].VolumeId' --output text
> aws ec2 delete-volume --region eu-west-1 --volume-id <vol-id>
> ```

Verify no orphaned ALBs or EBS volumes remain in the console.
