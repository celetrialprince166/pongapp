#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Deploy a new image tag to the pongapp ECS stack.
#   1. register a new backend task-def revision with the new image
#   2. run a one-shot migration task (entrypoint "migrate") and wait for exit 0
#   3. roll the backend service (rolling) to the new task def
#   4. register a new frontend task-def revision and update the frontend service
#      (ECS-native blue/green shifts traffic automatically)
#   5. wait for both services to stabilise, then smoke-test the ALB
#
# Required env: AWS_REGION, ACCOUNT_ID, IMAGE_TAG
# Derived names follow the Terraform naming convention (name_prefix=pongapp-prod).
# ---------------------------------------------------------------------------
set -euo pipefail

: "${AWS_REGION:?}" "${ACCOUNT_ID:?}" "${IMAGE_TAG:?}"

CLUSTER="pongapp-prod-cluster"
BE_SERVICE="pongapp-prod-backend"
FE_SERVICE="pongapp-prod-frontend"
ALB_NAME="pongapp-prod-alb"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
BE_IMAGE="${REGISTRY}/pongapp-backend:${IMAGE_TAG}"
FE_IMAGE="${REGISTRY}/pongapp-frontend:${IMAGE_TAG}"

# Register a new task-def revision based on the family's latest, swapping the
# named container's image. Echoes the new task definition ARN.
register_taskdef() {
  local family="$1" container="$2" image="$3" out
  out=$(mktemp)
  aws ecs describe-task-definition --task-definition "$family" --query 'taskDefinition' --output json \
    | jq --arg IMG "$image" --arg C "$container" '
        .containerDefinitions = (.containerDefinitions | map(if .name == $C then .image = $IMG else . end))
        | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
      ' > "$out"
  aws ecs register-task-definition --cli-input-json "file://$out" \
    --query 'taskDefinition.taskDefinitionArn' --output text
}

echo "::group::1. Register backend task definition (${IMAGE_TAG})"
BE_TD=$(register_taskdef "$BE_SERVICE" backend "$BE_IMAGE")
echo "backend task def: $BE_TD"
echo "::endgroup::"

echo "::group::2. Run one-shot migrations"
NETCFG=$(aws ecs describe-services --cluster "$CLUSTER" --services "$BE_SERVICE" \
  --query 'services[0].networkConfiguration' --output json)
TASK_ARN=$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$BE_TD" \
  --launch-type FARGATE --network-configuration "$NETCFG" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["migrate"]}]}' \
  --query 'tasks[0].taskArn' --output text)
echo "migration task: $TASK_ARN"
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN"
EXIT_CODE=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' --output text)
if [ "$EXIT_CODE" != "0" ]; then
  echo "Migration task exited with code '${EXIT_CODE}'. Stop reason:"
  aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
    --query 'tasks[0].stoppedReason' --output text
  exit 1
fi
echo "migrations OK"
echo "::endgroup::"

echo "::group::3. Roll backend service"
aws ecs update-service --cluster "$CLUSTER" --service "$BE_SERVICE" \
  --task-definition "$BE_TD" >/dev/null
echo "::endgroup::"

echo "::group::4. Deploy frontend (blue/green)"
FE_TD=$(register_taskdef "$FE_SERVICE" frontend "$FE_IMAGE")
echo "frontend task def: $FE_TD"
aws ecs update-service --cluster "$CLUSTER" --service "$FE_SERVICE" \
  --task-definition "$FE_TD" >/dev/null
echo "::endgroup::"

echo "::group::5. Wait for services to stabilise (blue/green bake included)"
aws ecs wait services-stable --cluster "$CLUSTER" --services "$BE_SERVICE" "$FE_SERVICE"
echo "services stable"
echo "::endgroup::"

echo "::group::6. Smoke test via ALB"
ALB_DNS=$(aws elbv2 describe-load-balancers --names "$ALB_NAME" \
  --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB: http://${ALB_DNS}"
curl -fsS --retry 5 --retry-delay 5 "http://${ALB_DNS}/api/health/" && echo
curl -fsS -o /dev/null -w "frontend HTTP %{http_code}\n" "http://${ALB_DNS}/"
echo "::endgroup::"

echo "Deploy complete: ${IMAGE_TAG}"
