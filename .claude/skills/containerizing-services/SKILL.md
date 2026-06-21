---
name: containerizing-services
description: Builds, hardens, and verifies Docker images for the pongapp tiers (Angular/nginx frontend, Django/gunicorn backend) and pushes them to Amazon ECR. Use when writing or fixing a Dockerfile, .dockerignore, or docker-compose file, when verifying the app runs locally before any cloud deploy, or when tagging and pushing images to ECR. Covers multi-stage builds, non-root users, image slimming, healthchecks, and SHA-based tagging.
---

# Containerizing services

Goal: produce small, secure, reproducible images for each tier and prove the
stack runs locally before it ever touches ECS or EKS. This is Phase 1 and the
foundation every later phase depends on.

## Existing assets (do not rewrite blindly — harden these)
- `Table-Tennis-Frontend/Dockerfile` — Angular build → nginx serve (port 80)
- `Table-Tennis-Backend/Dockerfile` — Django + `docker-entrypoint.sh` (port 8000)
- `docker-compose.yml` — frontend + backend + redis (postgres added via env)

## Principles
- **Multi-stage builds.** Build deps in an early stage; copy only artifacts into a
  slim runtime (`node:XX-alpine` → `nginx:alpine`; `python:3.x-slim`).
- **Non-root.** Add a dedicated user; never run the container as root.
- **Pin versions.** Pin base image tags; never `FROM node:latest`.
- **Healthchecks.** Every service defines a `HEALTHCHECK` (and a backend
  `/healthz` endpoint if missing — flag it, don't silently skip).
- **Small context.** Keep `.dockerignore` tight (node_modules, .git, tests, *.md).
- **One concern per image.** No app + db in one image.
- **SHA tags.** Tag `pongapp-frontend:<git-short-sha>` and also `:latest` locally
  only. Cloud task defs/manifests must reference the SHA tag.

## Workflow
```
- [ ] 1. Review each Dockerfile against the principles above; harden in place.
- [ ] 2. `docker compose build` — fix build errors.
- [ ] 3. `docker compose up -d` — bring up all tiers.
- [ ] 4. Verify: frontend reachable, backend /health OK, redis ping, db connects.
- [ ] 5. Capture evidence (triggers capturing-screenshots): compose ps, app UI.
- [ ] 6. Create ECR repos (one per image) and push SHA-tagged images.
- [ ] 7. Document image sizes + decisions (triggers writing-tutorials).
```

## ECR push (run after local verification passes)
```bash
aws ecr create-repository --repository-name pongapp-frontend --region "$AWS_REGION"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
docker tag pongapp-frontend:$SHA "$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/pongapp-frontend:$SHA"
docker push "$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/pongapp-frontend:$SHA"
```

## Verify (feedback loop)
After any image change: rebuild → `docker compose up -d` → hit the frontend and a
backend API route → only then push. If a container restarts repeatedly, read its
logs (`docker compose logs <svc>`) and fix before proceeding.

## Done when
Local compose stack is fully healthy, images are SHA-tagged and pushed to ECR,
and image sizes + key decisions are captured for the tutorial.
