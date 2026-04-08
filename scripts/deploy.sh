#!/bin/bash
# deploy.sh — LauncherEdu Platform
# Uso: ./deploy.sh [api|frontend|all]
# Exemplos:
#   ./deploy.sh all       → builda e deploya API + Frontend
#   ./deploy.sh frontend  → só o frontend (mais comum)
#   ./deploy.sh api       → só a API + Celery

set -e

# ── Configurações ─────────────────────────────────────────────────────────────
AWS_REGION="sa-east-1"
AWS_ACCOUNT="853696859705"
ECR_BASE="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
CLUSTER="concurso-platform-cluster"
NEXT_PUBLIC_API_URL="https://launcheredu.com.br/api/v1"

TARGET="${1:-all}"

# ── Login ECR ─────────────────────────────────────────────────────────────────
echo "→ Login no ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_BASE
echo "✓ Login OK"

# ── Função: build + push + deploy de um serviço ───────────────────────────────
deploy_service() {
  local SERVICE=$1   # ex: concurso-platform-api
  echo ""
  echo "→ Deployando $SERVICE..."

  # Pega task definition atual, remove campos read-only e registra nova revisão
  TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition $SERVICE \
    --region $AWS_REGION \
    --query taskDefinition \
    --output json)

  NEW_TASK=$(echo $TASK_DEF | python3 -c "
import sys, json
td = json.load(sys.stdin)
for k in ['taskDefinitionArn','revision','status','requiresAttributes',
          'compatibilities','registeredAt','registeredBy']:
    td.pop(k, None)
print(json.dumps(td))")

  ARN=$(aws ecs register-task-definition \
    --cli-input-json "$NEW_TASK" \
    --region $AWS_REGION \
    --query taskDefinition.taskDefinitionArn \
    --output text)

  aws ecs update-service \
    --cluster $CLUSTER \
    --service $SERVICE \
    --task-definition $ARN \
    --force-new-deployment \
    --region $AWS_REGION \
    --query "service.serviceName" \
    --output text

  echo "✓ $SERVICE deployado (task: $ARN)"
}

# ── API ───────────────────────────────────────────────────────────────────────
if [[ "$TARGET" == "api" || "$TARGET" == "all" ]]; then
  echo ""
  echo "═══ BUILD API ═══"
  docker build -f api/Dockerfile --target production \
    --no-cache \
    -t ${ECR_BASE}/concurso-platform-api:latest \
    api/
  docker push ${ECR_BASE}/concurso-platform-api:latest
  echo "✓ API image pushed"

  deploy_service "concurso-platform-api"
  deploy_service "concurso-platform-celery"
fi

# ── FRONTEND ──────────────────────────────────────────────────────────────────
if [[ "$TARGET" == "frontend" || "$TARGET" == "all" ]]; then
  echo ""
  echo "═══ BUILD FRONTEND ═══"

  # TypeScript check antes do build (evita pushes com erro de tipo)
  echo "→ Checando TypeScript..."
  cd frontend && npx tsc --noEmit && cd ..
  echo "✓ TypeScript OK"

  docker build -f frontend/Dockerfile \
    --no-cache \
    --build-arg NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    -t ${ECR_BASE}/concurso-platform-frontend:latest \
    frontend/
  docker push ${ECR_BASE}/concurso-platform-frontend:latest
  echo "✓ Frontend image pushed"

  deploy_service "concurso-platform-frontend"
fi

# ── Resumo ────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "✓ Deploy iniciado com sucesso!"
echo "  Aguarda 2-3 min para o ECS estabilizar"
echo ""
echo "  Admin:    https://launcheredu.com.br/admin-login"
echo "  Demo:     https://concurso-demo.launcheredu.com.br"
echo "  Landing:  https://launcheredu.com.br"
echo "════════════════════════════════════════"