#!/bin/bash
# scripts/deploy.sh
# Uso: bash scripts/deploy.sh          → detecta automaticamente
#      bash scripts/deploy.sh api      → força só API
#      bash scripts/deploy.sh frontend → força só frontend
#      bash scripts/deploy.sh all      → força tudo

set -euo pipefail

ECR="853696859705.dkr.ecr.sa-east-1.amazonaws.com"
CLUSTER="concurso-platform-cluster"
REGION="sa-east-1"
FORCE="${1:-auto}"

# Login ECR (rápido, sempre necessário)
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ECR 2>/dev/null
echo "✓ ECR login"

# Detecta o que mudou desde o último commit deployado
detect_changes() {
  local LAST_DEPLOY=$(git log --oneline -1 origin/main 2>/dev/null | cut -d' ' -f1 || echo "HEAD~1")
  git diff --name-only $LAST_DEPLOY HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD
}

CHANGED=$(detect_changes)
DEPLOY_API=false
DEPLOY_FRONTEND=false

case "$FORCE" in
  api)      DEPLOY_API=true ;;
  frontend) DEPLOY_FRONTEND=true ;;
  all)      DEPLOY_API=true; DEPLOY_FRONTEND=true ;;
  auto)
    echo "$CHANGED" | grep -qE "^api/" && DEPLOY_API=true && echo "→ Mudanças detectadas na API"
    echo "$CHANGED" | grep -qE "^frontend/" && DEPLOY_FRONTEND=true && echo "→ Mudanças detectadas no Frontend"
    ;;
esac

if [ "$DEPLOY_API" = false ] && [ "$DEPLOY_FRONTEND" = false ]; then
  echo "⚠ Nenhuma mudança detectada. Use 'bash scripts/deploy.sh all' para forçar."
  exit 0
fi

# Build e push
build_and_push() {
  local NAME=$1
  local DOCKERFILE=$2
  local CONTEXT=$3
  local EXTRA_ARGS="${4:-}"
  local IMAGE="$ECR/concurso-platform-$NAME:latest"

  echo "→ Build $NAME..."
  docker build -f $DOCKERFILE --target production $EXTRA_ARGS -t $IMAGE $CONTEXT
  docker push $IMAGE
  echo "✓ $NAME enviado"
}

if [ "$DEPLOY_API" = true ]; then
  build_and_push "api" "api/Dockerfile" "api/"
fi

if [ "$DEPLOY_FRONTEND" = true ]; then
  build_and_push "frontend" "frontend/Dockerfile" "frontend/" \
    "--build-arg NEXT_PUBLIC_API_URL=http://concurso-platform-alb-1231839356.sa-east-1.elb.amazonaws.com/api/v1"
fi

# Atualiza ECS só para os serviços que foram rebuilados
update_ecs() {
  local SERVICE="concurso-platform-$1"
  echo "→ Atualizando ECS: $SERVICE..."

  TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition $SERVICE --region $REGION \
    --query taskDefinition --output json)

  NEW_TASK=$(echo $TASK_DEF | python3 -c "
import sys, json
td = json.load(sys.stdin)
[td.pop(k, None) for k in ['taskDefinitionArn','revision','status',
  'requiresAttributes','compatibilities','registeredAt','registeredBy']]
print(json.dumps(td))")

  ARN=$(aws ecs register-task-definition \
    --cli-input-json "$NEW_TASK" --region $REGION \
    --query taskDefinition.taskDefinitionArn --output text)

  aws ecs update-service \
    --cluster $CLUSTER --service $SERVICE \
    --task-definition $ARN --force-new-deployment \
    --region $REGION --query "service.serviceName" --output text

  echo "✓ $SERVICE atualizado"
}

[ "$DEPLOY_API" = true ]      && update_ecs "api"
[ "$DEPLOY_FRONTEND" = true ] && update_ecs "frontend"

echo ""
echo "✓ Deploy iniciado!"
echo "  API rodando em ~2 min"
echo "  Acompanhe: aws ecs wait services-stable --cluster $CLUSTER --services concurso-platform-api --region $REGION"