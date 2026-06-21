# Table Tennis Kube - Kubernetes Migration Roadmap
## From Minikube to EKS (Production-Ready)

**Project Overview:**
- **Frontend:** Angular 20 + Nginx (Docker: `franzjameskaba/ttl-frontend:latest`)
- **Backend:** Django 5.0 + Daphne (ASGI) + Channels (WebSocket) + Redis (`franzjameskaba/ttl-backend:latest`)
- **Database:** PostgreSQL (RDS in production, in-cluster for Minikube)
- **Current State:** Docker Compose setup, images on Docker Hub, CORS_ALLOW_ALL_ORIGINS=True (fix before prod)

---

## Phase 0: Pre-Migration Code Fixes ⚠️ DO THIS FIRST

### Step 0.1: Add Health Check Endpoints
**Why:** K8s probes need `/health/` and `/ready/` endpoints. Currently none exist.

**File to modify:** `Table-Tennis-Backend/backend/table_tennis_app/urls.py`
```python
# Add to urlpatterns:
path('api/health/', lambda r: JsonResponse({'status': 'healthy'}), name='health'),
path('api/ready/', lambda r: JsonResponse({'status': 'ready'}), name='ready'),
```

### Step 0.2: Fix CORS for Production
**Why:** `CORS_ALLOW_ALL_ORIGINS = True` is insecure for production.

**File to modify:** `Table-Tennis-Backend/backend/table_tennis_app/settings.py`
```python
# Replace CORS_ALLOW_ALL_ORIGINS = True with:
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
# Example: http://localhost,http://table-tennis.local
```

### Step 0.3: Add S3 Support for EKS Media Storage
**Why:** Minikube uses PVC; EKS should use S3 for media files (scalable, durable).

**Files to modify:**
- `requirements.txt`: Add `django-storages[boto3]` and `boto3`
- `settings.py`: Add conditional S3 config based on `USE_S3` env var

```python
# In settings.py
USE_S3 = os.environ.get('USE_S3', 'False') == 'True'
if USE_S3:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME')
    AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'
```

**Success Criteria:**
- Health endpoints return 200
- CORS only allows configured origins
- Media uploads work locally (PVC) and on S3 (EKS)

---

## Phase 1: Foundation & Prerequisites

### Step 1: Set Up Minikube Cluster ✅ FIRST INFRASTRUCTURE STEP
**Why first:** Nothing works without a running Kubernetes cluster.

```bash
# Install Minikube (if not installed)
choco install minikube

# Start Minikube with adequate resources for Django + Redis + PostgreSQL
minikube start --cpus=4 --memory=8192 --disk-size=20g

# Enable required addons
minikube addons enable ingress
minikube addons enable metrics-server

# Verify cluster is running
kubectl cluster-info
kubectl get nodes
```

**Success Criteria:**
- `kubectl cluster-info` shows cluster is running
- `kubectl get nodes` shows Ready status

---

### Step 2: Create Namespace & RBAC
**Why:** Namespace isolation and security policies must exist before deploying apps.

**Files to create:**
- `k8s/namespace.yaml`
- `k8s/rbac/service-account.yaml`
- `k8s/rbac/role.yaml`
- `k8s/rbac/role-binding.yaml`
- `k8s/resource-quota.yaml` - Prevent resource exhaustion
- `k8s/limit-range.yaml` - Default resource constraints

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: table-tennis
  labels:
    name: table-tennis
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

**Success Criteria:**
- Namespace created with Pod Security Standards set to `restricted`

---

## Phase 2: Secrets & ConfigMaps

### Step 3: Create All Secrets
**Files to create:**
- `k8s/secrets/db-credentials.yaml` - PostgreSQL credentials
- `k8s/secrets/app-secrets.yaml` - DJANGO_SECRET_KEY, AWS keys
- `k8s/secrets/redis-secret.yaml` - Redis auth (optional)

**Important:** Base64 encode values:
```bash
echo -n "your-secret-value" | base64
```

### Step 4: Create All ConfigMaps
**Files to create:**
- `k8s/configmaps/env-config.yaml` - Non-sensitive env vars
- `k8s/configmaps/nginx-config.yaml` - Custom nginx config for frontend
- `k8s/configmaps/backend-settings.yaml` - Django settings

**Key env vars for backend:**
```yaml
# env-config.yaml
data:
  DJANGO_SETTINGS_MODULE: "table_tennis_app.settings"
  DJANGO_DEBUG: "False"
  DJANGO_ALLOWED_HOSTS: "*,localhost,table-tennis.local"
  CORS_ALLOWED_ORIGINS: "http://localhost,http://table-tennis.local"
  DB_HOST: "postgres.table-tennis.svc.cluster.local"
  DB_PORT: "5432"
  DB_NAME: "table_tennis_db"
  DB_USER: "ttl_user"
  USE_S3: "False"  # True for EKS
  REDIS_HOST: "redis.table-tennis.svc.cluster.local"
  REDIS_PORT: "6379"
```

---

## Phase 3: Database Layer (PostgreSQL)

### Step 5: Deploy PostgreSQL to Minikube
**Strategy:** StatefulSet + PVC + Headless Service

**Files to create:**
- `k8s/postgres/pvc.yaml` - Persistent storage (10Gi)
- `k8s/postgres/secret.yaml` - DB credentials (reference from step 3)
- `k8s/postgres/service.yaml` - Headless ClusterIP service
- `k8s/postgres/statefulset.yaml` - Database pod with health checks

**Key configuration:**
```yaml
# statefulset.yaml
spec:
  containers:
  - name: postgres
    image: postgres:17-alpine
    ports:
    - containerPort: 5432
    envFrom:
    - secretRef:
        name: db-credentials
    volumeMounts:
    - name: data
      mountPath: /var/lib/postgresql/data
    # Health checks
    livenessProbe:
      exec:
        command: ["pg_isready", "-U", "ttl_user"]
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      exec:
        command: ["pg_isready", "-U", "ttl_user"]
      initialDelaySeconds: 5
      periodSeconds: 5
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: postgres-pvc
```

**Success Criteria:**
- Pod reaches Ready state
- Can connect: `kubectl run -it --rm debug --image=postgres:17-alpine --restart=Never -- psql -h postgres.table-tennis.svc.cluster.local -U ttl_user table_tennis_db`

---

## Phase 4: Redis Deployment

### Step 6: Deploy Redis
**Strategy:** Deployment + ClusterIP Service (cache doesn't need persistence for this app)

**Files to create:**
- `k8s/redis/deployment.yaml`
- `k8s/redis/service.yaml`

**Key configuration:**
```yaml
# deployment.yaml
spec:
  containers:
  - name: redis
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "no"]  # Stateless for cache
    ports:
    - containerPort: 6379
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "512Mi"
        cpu: "500m"
    # Health check
    livenessProbe:
      tcpSocket:
        port: 6379
      initialDelaySeconds: 5
      periodSeconds: 10
```

**Success Criteria:**
- Redis pod running
- Backend can connect via `redis.table-tennis.svc.cluster.local:6379`

---

## Phase 5: Backend Deployment

### Step 7: Create Init Container for Migrations
**Why:** Run DB migrations before backend starts (prevents race conditions).

**Files to create:**
- `k8s/backend/init-migration-job.yaml` (optional: separate job)
- `k8s/backend/backend-deployment.yaml` (with init container)
- `k8s/backend/backend-service.yaml`
- `k8s/backend/pvc-media.yaml` - Media files storage
- `k8s/backend/pvc-static.yaml` - Static files storage

**Key configuration:**
```yaml
# backend-deployment.yaml
spec:
  replicas: 2  # Start with 2 for HA
  template:
    spec:
      initContainers:
      - name: migrate
        image: franzjameskaba/ttl-backend:latest
        command: ["python", "manage.py", "migrate", "--noinput"]
        envFrom:
        - configMapRef:
            name: env-config
        - secretRef:
            name: app-secrets
        - secretRef:
            name: db-credentials
      containers:
      - name: backend
        image: franzjameskaba/ttl-backend:latest
        command: ["daphne", "-b", "0.0.0.0", "-p", "8000", "table_tennis_app.asgi:application"]
        ports:
        - containerPort: 8000
          name: http
        envFrom:
        - configMapRef:
            name: env-config
        - secretRef:
            name: app-secrets
        - secretRef:
            name: db-credentials
        # Health checks
        livenessProbe:
          httpGet:
            path: /api/health/
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready/
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        # Resource limits
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        # Security context
        securityContext:
          allowPrivilegeEscalation: false
          runAsNonRoot: true
          runAsUser: 1000
          readOnlyRootFilesystem: false  # Needs write for media/uploads
        volumeMounts:
        - name: media
          mountPath: /app/media
        - name: static
          mountPath: /app/staticfiles
      volumes:
      - name: media
        persistentVolumeClaim:
          claimName: backend-media-pvc
      - name: static
        persistentVolumeClaim:
          claimName: backend-static-pvc
```

**Success Criteria:**
- Backend pods running with migrations applied
- `kubectl port-forward -n table-tennis svc/backend 8000:8000`
- Access `http://localhost:8000/api/health/` returns `{"status": "healthy"}`

---

## Phase 6: Frontend Deployment

### Step 8: Deploy Frontend (Angular + Nginx)
**Important:** Update `nginx/default.conf` to use K8s service DNS names.

**Files to create:**
- `k8s/frontend/frontend-configmap.yaml` - Updated nginx config
- `k8s/frontend/frontend-deployment.yaml`
- `k8s/frontend/frontend-service.yaml`

**Updated nginx config (key changes):**
```nginx
# In k8s/frontend/frontend-configmap.yaml
# Change proxy_pass to use K8s service DNS:
proxy_pass http://backend.table-tennis.svc.cluster.local:8000/api/;
proxy_pass http://backend.table-tennis.svc.cluster.local:8000/ws/;
```

**Frontend deployment key config:**
```yaml
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: frontend
        image: franzjameskaba/ttl-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
        securityContext:
          allowPrivilegeEscalation: false
          runAsNonRoot: true
          runAsUser: 101  # nginx user
```

**Success Criteria:**
- Frontend pods running
- Nginx serving Angular app
- API proxy to backend working via internal DNS

---

## Phase 7: Ingress & External Access

### Step 9: Configure Ingress for Minikube
**Strategy:** nginx-ingress (already enabled) + Ingress resource

**Files to create:**
- `k8s/ingress/ingress.yaml`

**Configuration:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: table-tennis-ingress
  namespace: table-tennis
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  ingressClassName: nginx
  rules:
  - host: table-tennis.local
    http:
      paths:
      # WebSocket path (must be first for priority)
      - path: /ws
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      # API path
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      # Django admin
      - path: /djadmin
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      # Everything else to frontend
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

**For Minikube testing:**
```bash
# Add entry to hosts file (Windows: C:\Windows\System32\drivers\etc\hosts)
echo "$(minikube ip) table-tennis.local" >> C:\Windows\System32\drivers\etc\hosts

# Test access
curl http://table-tennis.local
curl http://table-tennis.local/api/health/
```

**Success Criteria:**
- Ingress routes traffic correctly
- Frontend accessible via `http://table-tennis.local`
- API calls from frontend reach backend
- WebSocket connections work on `/ws/` path

---

## Phase 8: Scaling & High Availability

### Step 10: Add Horizontal Pod Autoscaler (HPA)
**Why:** Automatically scale based on CPU/memory usage.

**Files to create:**
- `k8s/backend/backend-hpa.yaml`
- `k8s/frontend/frontend-hpa.yaml`

```yaml
# backend-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: table-tennis
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Step 11: Add Pod Disruption Budget (PDB)
**Why:** Ensure availability during node drains/updates.

**Files to create:**
- `k8s/backend/backend-pdb.yaml`
- `k8s/frontend/frontend-pdb.yaml`

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: backend-pdb
  namespace: table-tennis
spec:
  minAvailable: 1  # or maxUnavailable: 1
  selector:
    matchLabels:
      app: backend
```

**Success Criteria:**
- HPA scales pods based on load
- PDB prevents all pods from going down simultaneously

---

## Phase 9: Testing & Validation

### Step 12: End-to-End Testing
**Tests to run:**

1. **Connectivity:**
   ```bash
   # Test frontend → backend API
   kubectl exec -n table-tennis deploy/frontend -- curl http://backend:8000/api/health/
   
   # Test backend → PostgreSQL
   kubectl exec -n table-tennis deploy/backend -- python manage.py dbshell
   
   # Test backend → Redis
   kubectl exec -n table-tennis deploy/backend -- python -c "import redis; r=redis.Redis(host='redis'); print(r.ping())"
   ```

2. **WebSocket Test:**
   ```bash
   # Port forward and test with wscat
   kubectl port-forward -n table-tennis svc/backend 8000:8000
   wscat -c ws://localhost:8000/ws/some-path
   ```

3. **Data persistence:**
   - Upload media files (user avatars)
   - Delete pod and verify new pod has access to same files (PVC working)

4. **Scaling test:**
   ```bash
   kubectl scale -n table-tennis deployment backend --replicas=5
   kubectl get pods -n table-tennis -w  # Watch rollout
   ```

---

## Phase 10: Migration to EKS

### Step 13: Prepare EKS Infrastructure (Terraform)
**Using `terraform-style-guide` skill:**

**Files to create:**
- `terraform/main.tf` - EKS cluster with VPC CNI
- `terraform/vpc.tf` - VPC with public/private subnets across 3 AZs
- `terraform/node-groups.tf` - Managed node groups (system + application pools)
- `terraform/rds.tf` - RDS PostgreSQL instance
- `terraform/s3.tf` - S3 bucket for media files
- `terraform/iam.tf` - IAM Roles for Service Accounts (IRSA)

**Key EKS-specific changes:**

| Component | Minikube | EKS |
|-----------|----------|-----|
| PostgreSQL | StatefulSet + PVC | RDS (managed) |
| Media Storage | PVC (local-path) | S3 with django-storages |
| Ingress | nginx-ingress | AWS Load Balancer Controller (ALB) or Gateway API |
| Storage Class | standard | gp3 (EBS CSI driver) |
| IAM | N/A | IRSA for S3, RDS access |
| Secrets | K8s Secrets (base64) | AWS Secrets Manager + CSI driver (optional) |
| Load Balancer | NodePort/ClusterIP | ALB (Application Load Balancer) |

### Step 14: Update Manifests for EKS

**Changes needed:**

1. **Database:** Remove `k8s/postgres/` resources, update ConfigMap:
   ```yaml
   # k8s/configmaps/env-config.yaml (EKS version)
   data:
     DB_HOST: "table-tennis-db.xxxxx.us-east-1.rds.amazonaws.com"  # RDS endpoint
     USE_S3: "True"
     AWS_STORAGE_BUCKET_NAME: "table-tennis-media"
     AWS_S3_REGION_NAME: "us-east-1"
   ```

2. **Ingress (EKS with ALB):**
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: table-tennis-alb
     annotations:
       alb.ingress.kubernetes.io/scheme: internet-facing
       alb.ingress.kubernetes.io/target-type: ip
       alb.ingress.kubernetes.io/group.name: table-tennis
   spec:
     ingressClassName: alb
     rules:
     - host: table-tennis.yourdomain.com
       http:
         paths:
         - path: /ws
           pathType: Prefix
           backend:
             service:
               name: backend
               port:
                 number: 8000
         # ... rest of paths
   ```

3. **IRSA for S3 Access:**
   ```yaml
   # k8s/backend/service-account.yaml
   apiVersion: v1
   kind: ServiceAccount
   metadata:
     name: backend-sa
     namespace: table-tennis
     annotations:
       eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT_ID:role/table-tennis-s3-role
   ```

### Step 15: Deploy to EKS
```bash
# Update kubeconfig to point to EKS
aws eks update-kubeconfig --name table-tennis-cluster --region us-east-1

# Apply all manifests
kubectl apply -f k8s/

# Verify deployment
kubectl get pods -n table-tennis
kubectl get svc -n table-tennis
kubectl get ingress -n table-tennis
```

---

## Phase 11: CI/CD Pipeline

### Step 16: Automate Deployments
**Using `github-actions-docs` skill:**

**Files to create:**
- `.github/workflows/build-push.yml` - Build & push to Docker Hub
- `.github/workflows/deploy-staging.yml` - Deploy to Minikube (for testing)
- `.github/workflows/deploy-prod.yml` - Deploy to EKS

**Pipeline flow:**
1. Push to `develop` → Build images → Deploy to Minikube (staging)
2. PR merge to `main` → Build images → Deploy to EKS (production)

---

## Complete File Structure

```
tabltennis-kube/
├── k8s/
│   ├── namespace.yaml
│   ├── resource-quota.yaml
│   ├── limit-range.yaml
│   ├── rbac/
│   │   ├── service-account.yaml
│   │   ├── role.yaml
│   │   └── role-binding.yaml
│   ├── configmaps/
│   │   ├── env-config.yaml
│   │   ├── nginx-config.yaml
│   │   └── backend-settings.yaml
│   ├── secrets/
│   │   ├── db-credentials.yaml
│   │   ├── app-secrets.yaml
│   │   └── redis-secret.yaml
│   ├── postgres/
│   │   ├── pvc.yaml
│   │   ├── secret.yaml
│   │   ├── service.yaml
│   │   └── statefulset.yaml
│   ├── redis/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── backend/
│   │   ├── backend-deployment.yaml
│   │   ├── backend-service.yaml
│   │   ├── backend-hpa.yaml
│   │   ├── backend-pdb.yaml
│   │   ├── pvc-media.yaml
│   │   ├── pvc-static.yaml
│   │   └── service-account.yaml
│   ├── frontend/
│   │   ├── frontend-deployment.yaml
│   │   ├── frontend-service.yaml
│   │   ├── frontend-hpa.yaml
│   │   ├── frontend-pdb.yaml
│   │   └── frontend-configmap.yaml
│   └── ingress/
│       └── ingress.yaml
├── terraform/ (for EKS)
│   ├── main.tf
│   ├── vpc.tf
│   ├── node-groups.tf
│   ├── rds.tf
│   ├── s3.tf
│   └── iam.tf
├── .github/workflows/
│   ├── build-push.yml
│   ├── deploy-staging.yml
│   └── deploy-prod.yml
└── K8S-MIGRATION-ROADMAP.md (this file)
```

---

## Industry Best Practices Followed ✅

1. **Portable manifests:** No Minikube/EKS-specific annotations in base files
2. **Resource management:** Requests + limits on all containers
3. **Health checks:** Liveness + readiness probes on all pods
4. **Security:** Non-root containers, Pod Security Standards (restricted), IRSA for AWS
5. **Storage:** PVCs for local dev, S3 for EKS media files
6. **Networking:** ClusterIP internally, Ingress externally + WebSocket support
7. **Observability:** Metrics server, HPA, structured logging
8. **High Availability:** PDBs, multiple replicas, spread across AZs (EKS)
9. **GitOps ready:** All configs in version control
10. **CORS fixed:** No more `CORS_ALLOW_ALL_ORIGINS = True`
11. **Health endpoints:** Explicit `/api/health/` and `/api/ready/` endpoints
12. **Init containers:** DB migrations run before app starts
13. **WebSocket support:** Separate Ingress path with `pathType: Prefix` for `/ws/`

---

## Quick Reference: First 5 Commands

```bash
# 1. Start Minikube
minikube start --cpus=4 --memory=8192

# 2. Enable ingress
minikube addons enable ingress

# 3. Create namespace
kubectl create namespace table-tennis

# 4. Apply all K8s manifests
kubectl apply -f k8s/

# 5. Check all resources
kubectl get all -n table-tennis
```

---

## Next Steps

1. **Execute Phase 0:** Fix CORS, add health endpoints, add S3 support to code
2. **Execute Phase 1:** Set up Minikube cluster
3. **Execute Phase 2-9:** Deploy stack to Minikube, test thoroughly
4. **Execute Phase 10-15:** Migrate to EKS
5. **Execute Phase 16:** Set up CI/CD

**Estimated timeline:** 2-3 weeks for full migration (assuming part-time effort)
