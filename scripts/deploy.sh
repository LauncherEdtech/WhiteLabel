#!/bin/bash
# deploy.sh — LauncherEdu Platform
# Uso: ./deploy.sh [api|all]
#
# Exemplos:
#   ./deploy.sh api   → builda e deploya API + Celery
#   ./deploy.sh all   → igual a api (mantido para compatibilidade)
#
# NOTA: Frontend foi migrado para Vercel.
#       Deploy do frontend é automático via git push para main.

set -e

# ── Configurações ─────────────────────────────────────────────────────────────
AWS_REGION="us-east-1"
CLUSTER="concurso-platform-cluster"
GHCR_BASE="ghcr.io/launcheredtech/whitelabel"
GITHUB_ACTOR="${GITHUB_ACTOR:-launcheredtech}"

TARGET="${1:-api}"

# ── Login GHCR ────────────────────────────────────────────────────────────────
# Em CI usa GITHUB_TOKEN (nativo, sem criar secrets extras).
# Localmente usa CR_PAT (Personal Access Token com escopo write:packages).
echo "→ Login no GHCR..."
if [ -n "$GITHUB_TOKEN" ]; then
  echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin
elif [ -n "$CR_PAT" ]; then
  echo "$CR_PAT" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin
else
  echo "❌ Defina CR_PAT para uso local:"
  echo "   export CR_PAT=ghp_..."
  exit 1
fi
echo "✓ Login GHCR OK"

# ── Função: registra nova task definition e faz deploy ────────────────────────
deploy_service() {
  local SERVICE=$1
  echo ""
  echo "→ Deployando $SERVICE..."

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

# ── API + CELERY ──────────────────────────────────────────────────────────────
if [[ "$TARGET" == "api" || "$TARGET" == "all" ]]; then
  echo ""
  echo "═══ BUILD API ═══"

  GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "local")

  docker build -f api/Dockerfile --target production \
    --no-cache \
    -t ${GHCR_BASE}/api:latest \
    -t ${GHCR_BASE}/api:${GIT_SHA} \
    api/

  docker push ${GHCR_BASE}/api:latest
  docker push ${GHCR_BASE}/api:${GIT_SHA}
  echo "✓ API image pushed → GHCR (sha: ${GIT_SHA})"

  deploy_service "concurso-platform-api"
  deploy_service "concurso-platform-celery"
fi

# ── Resumo ────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
echo "✓ Deploy iniciado com sucesso!"
echo "  Aguarda 2-3 min para o ECS estabilizar."
echo ""
echo "  API + Celery → ECS rolling deploy"
echo "  Frontend     → Vercel (automático via git push)"
echo ""
echo "  Admin:  https://launcheredu.com.br/admin-login"
echo "  Demo:   https://concurso-demo.launcheredu.com.br"
echo "════════════════════════════════════════════════════"