#!/bin/bash
# scripts/diagnose.sh
# Diagnóstico completo: Docker, Backend Flask, Frontend Next.js, Rede, Portas, Arquivos.
# Uso: bash scripts/diagnose.sh
# Gera relatório detalhado e sugere correções automáticas.

set -uo pipefail

# ── Cores ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Contadores ─────────────────────────────────────────────────────────────────
ERRORS=0
WARNINGS=0
FIXES=0
declare -a ERROR_LIST=()
declare -a WARNING_LIST=()
declare -a FIX_LIST=()

# ── Helpers ────────────────────────────────────────────────────────────────────
pass()    { echo -e "  ${GREEN}✓${NC}  $1"; }
fail()    { echo -e "  ${RED}✗${NC}  $1"; ERRORS=$((ERRORS+1)); ERROR_LIST+=("$1"); }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $1"; WARNINGS=$((WARNINGS+1)); WARNING_LIST+=("$1"); }
info()    { echo -e "  ${BLUE}→${NC}  $1"; }
fix()     { echo -e "  ${MAGENTA}🔧${NC}  $1"; FIXES=$((FIXES+1)); FIX_LIST+=("$1"); }
detail()  { echo -e "  ${DIM}   $1${NC}"; }
section() { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }
code()    { echo -e "  ${DIM}$ $1${NC}"; }

# ── Log file ───────────────────────────────────────────────────────────────────
LOG_FILE="/tmp/diagnose_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

# ── Início ─────────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║        DIAGNÓSTICO COMPLETO — Concurso Platform         ║"
echo "  ║   Backend · Frontend · Docker · Network · Arquivos      ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${DIM}Iniciado em: $(date '+%d/%m/%Y %H:%M:%S')${NC}"
echo -e "  ${DIM}Log salvo em: $LOG_FILE${NC}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
section "1. AMBIENTE DO SISTEMA"
# ══════════════════════════════════════════════════════════════════════════════

# OS
OS=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || uname -s)
pass "Sistema: $OS"

# Codespaces?
if [ -n "${CODESPACE_NAME:-}" ]; then
  pass "Ambiente: GitHub Codespaces ($CODESPACE_NAME)"
  IS_CODESPACES=true
else
  info "Ambiente: Local (não é Codespaces)"
  IS_CODESPACES=false
fi

# Arquitetura
ARCH=$(uname -m)
pass "Arquitetura: $ARCH"

# Memória disponível
if command -v free >/dev/null 2>&1; then
  MEM_FREE=$(free -m | awk '/^Mem:/{print $7}')
  MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
  if [ "${MEM_FREE:-0}" -lt 512 ] 2>/dev/null; then
    warn "Memória livre baixa: ${MEM_FREE}MB de ${MEM_TOTAL}MB"
  else
    pass "Memória: ${MEM_FREE}MB livres de ${MEM_TOTAL}MB"
  fi
fi

# Disco
DISK_USAGE=$(df -h . 2>/dev/null | awk 'NR==2{print $5}' | tr -d '%')
DISK_AVAIL=$(df -h . 2>/dev/null | awk 'NR==2{print $4}')
if [ "${DISK_USAGE:-0}" -gt 90 ] 2>/dev/null; then
  warn "Disco quase cheio: ${DISK_USAGE}% usado (apenas ${DISK_AVAIL} livre)"
else
  pass "Disco: ${DISK_USAGE}% usado (${DISK_AVAIL} disponível)"
fi

# ══════════════════════════════════════════════════════════════════════════════
section "2. FERRAMENTAS NECESSÁRIAS"
# ══════════════════════════════════════════════════════════════════════════════

check_cmd() {
  local cmd=$1
  local label=$2
  if command -v "$cmd" >/dev/null 2>&1; then
    local version
    version=$("$cmd" --version 2>/dev/null | head -1 || echo "instalado")
    pass "$label: $version"
    return 0
  else
    fail "$label: NÃO encontrado"
    return 1
  fi
}

check_cmd "docker"       "Docker"
check_cmd "git"          "Git"
check_cmd "node"         "Node.js"
check_cmd "npm"          "npm"
check_cmd "python3"      "Python 3"
check_cmd "curl"         "curl"

# Docker Compose
if docker compose version >/dev/null 2>&1; then
  pass "Docker Compose: $(docker compose version --short 2>/dev/null || echo 'ok')"
else
  fail "Docker Compose: NÃO disponível"
  fix "Instale o plugin Docker Compose: apt-get install docker-compose-plugin"
fi

# Node version check
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node --version | tr -d 'v' | cut -d'.' -f1)
  if [ "${NODE_VER:-0}" -lt 18 ] 2>/dev/null; then
    warn "Node.js versão antiga: $(node --version) — recomendado 18+"
    fix "Use nvm: nvm install 20 && nvm use 20"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
section "3. DOCKER"
# ══════════════════════════════════════════════════════════════════════════════

# Docker daemon
if docker info >/dev/null 2>&1; then
  pass "Docker daemon: rodando"
else
  fail "Docker daemon: NÃO está rodando"
  fix "Tente: export DOCKER_HOST=unix:///var/run/docker-host.sock"

  # Tenta sockets alternativos
  for sock in /var/run/docker-host.sock /var/run/docker.sock /tmp/docker.sock; do
    if [ -S "$sock" ]; then
      fix "Socket encontrado em $sock — rode: export DOCKER_HOST=unix://$sock"
    fi
  done
fi

# DOCKER_API_VERSION
if [ -n "${DOCKER_API_VERSION:-}" ]; then
  pass "DOCKER_API_VERSION=$DOCKER_API_VERSION"
else
  warn "DOCKER_API_VERSION não definida"
  fix "Se tiver erros de API version: echo 'export DOCKER_API_VERSION=1.43' >> ~/.bashrc && source ~/.bashrc"
fi

# Containers
echo ""
info "Status dos containers:"
CONTAINERS=("concurso_postgres" "concurso_redis" "concurso_api" "concurso_celery" "concurso_flower")

for name in "${CONTAINERS[@]}"; do
  STATUS=$(docker inspect "$name" --format='{{.State.Status}}' 2>/dev/null || echo "not_found")
  HEALTH=$(docker inspect "$name" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")

  case $STATUS in
    "running")
      if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "none" ]; then
        pass "$name: running"
      elif [ "$HEALTH" = "starting" ]; then
        warn "$name: running (health ainda iniciando)"
      else
        warn "$name: running — health=$HEALTH"
        info "Últimas linhas de log:"
        docker logs "$name" --tail=5 2>&1 | sed 's/^/    /'
      fi
      ;;
    "restarting")
      fail "$name: RESTARTING (crash loop)"
      info "Causa provável (últimas linhas):"
      docker logs "$name" --tail=10 2>&1 | sed 's/^/    /'
      ;;
    "exited")
      EXIT_CODE=$(docker inspect "$name" --format='{{.State.ExitCode}}' 2>/dev/null || echo "?")
      fail "$name: EXITED (código $EXIT_CODE)"
      info "Últimas linhas de log:"
      docker logs "$name" --tail=10 2>&1 | sed 's/^/    /'
      ;;
    "not_found")
      warn "$name: não criado (docker compose up não foi rodado?)"
      ;;
    *)
      warn "$name: status=$STATUS"
      ;;
  esac
done

# Imagens
echo ""
info "Imagens disponíveis:"
docker images --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}" 2>/dev/null | \
  grep -E "concurso|whitelabel|postgres|redis" | sed 's/^/  /' || detail "Nenhuma imagem do projeto encontrada"

# Volumes
echo ""
info "Volumes:"
docker volume ls --format "  {{.Name}}" 2>/dev/null | grep -E "concurso|whitelabel|postgres|redis" || \
  detail "Nenhum volume do projeto"

# ══════════════════════════════════════════════════════════════════════════════
section "4. BACKEND — Flask API"
# ══════════════════════════════════════════════════════════════════════════════

# Health check
FLASK_URL="http://localhost:5000"
HEALTH=$(curl -sf --max-time 5 "$FLASK_URL/health" 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q '"ok"'; then
  pass "Flask /health: ok"
else
  fail "Flask /health: não respondeu ($HEALTH)"
  fix "Verifique: docker compose logs api --tail=30"
fi

READY=$(curl -sf --max-time 5 "$FLASK_URL/health/ready" 2>/dev/null || echo "FAIL")
if echo "$READY" | grep -q '"ready"'; then
  pass "Flask /health/ready: banco conectado"
else
  fail "Flask /health/ready: $READY"
fi

# Rotas disponíveis
echo ""
info "Testando rotas críticas:"
declare -A ROUTES=(
  ["POST /auth/login"]="$FLASK_URL/api/v1/auth/login"
  ["GET /courses/"]="$FLASK_URL/api/v1/courses/"
  ["GET /questions/"]="$FLASK_URL/api/v1/questions/"
  ["GET /analytics/student/dashboard"]="$FLASK_URL/api/v1/analytics/student/dashboard"
)

for route in "${!ROUTES[@]}"; do
  URL="${ROUTES[$route]}"
  STATUS=$(curl -sf --max-time 5 -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null || echo "000")
  # 200=ok, 401=precisa de auth (rota existe), 405=método errado mas rota existe
  if [[ "$STATUS" =~ ^(200|201|401|405|422)$ ]]; then
    pass "$route → HTTP $STATUS (rota existe)"
  elif [ "$STATUS" = "404" ]; then
    fail "$route → HTTP 404 (rota não encontrada)"
  elif [ "$STATUS" = "000" ]; then
    fail "$route → sem resposta (API offline?)"
  else
    warn "$route → HTTP $STATUS"
  fi
done

# Banco de dados
echo ""
info "Banco de dados:"
if docker exec concurso_postgres psql -U concurso_user -d concurso_platform \
  -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
  >/dev/null 2>&1; then

  TABLE_COUNT=$(docker exec concurso_postgres psql -U concurso_user -d concurso_platform \
    -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
    2>/dev/null | tr -d ' \n')
  pass "PostgreSQL: $TABLE_COUNT tabelas criadas"

  # Verifica migration
  MIGRATION=$(docker exec concurso_postgres psql -U concurso_user -d concurso_platform \
    -t -c "SELECT version_num FROM alembic_version LIMIT 1;" \
    2>/dev/null | tr -d ' \n')
  if [ -n "$MIGRATION" ]; then
    pass "Migration: $MIGRATION"
  else
    warn "Nenhuma migration aplicada"
    fix "Rode: docker compose run --rm api flask db upgrade"
  fi

  # Verifica dados de seed
  USER_COUNT=$(docker exec concurso_postgres psql -U concurso_user -d concurso_platform \
    -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d ' \n' || echo "0")
  TENANT_COUNT=$(docker exec concurso_postgres psql -U concurso_user -d concurso_platform \
    -t -c "SELECT count(*) FROM tenants;" 2>/dev/null | tr -d ' \n' || echo "0")

  if [ "${USER_COUNT:-0}" -gt 0 ]; then
    pass "Seed: $USER_COUNT usuários, $TENANT_COUNT tenants"
  else
    warn "Banco vazio — seed não foi executado"
    fix "Rode: docker compose run --rm api python seed.py"
  fi
else
  fail "PostgreSQL: não acessível"
  fix "Rode: docker compose up -d postgres && sleep 10"
fi

# Redis
echo ""
info "Redis:"
if docker exec concurso_redis redis-cli -a redis_dev_pass ping >/dev/null 2>&1; then
  pass "Redis: respondendo PING"
  REDIS_KEYS=$(docker exec concurso_redis redis-cli -a redis_dev_pass DBSIZE 2>/dev/null | tr -d ' ')
  detail "Chaves armazenadas: ${REDIS_KEYS:-0}"
else
  fail "Redis: não responde"
fi

# Logs recentes da API
echo ""
info "Últimas linhas de log da API:"
docker logs concurso_api --tail=15 2>/dev/null | sed 's/^/  /' || detail "Container não disponível"

# ══════════════════════════════════════════════════════════════════════════════
section "5. FRONTEND — Next.js"
# ══════════════════════════════════════════════════════════════════════════════

FRONTEND_DIR="frontend"

# Verifica se a pasta existe
if [ ! -d "$FRONTEND_DIR" ]; then
  fail "Pasta frontend/ não encontrada"
  fix "Rode: bash scripts/create_frontend.sh"
else
  pass "Pasta frontend/ existe"
fi

# package.json
if [ -f "$FRONTEND_DIR/package.json" ]; then
  pass "package.json encontrado"
  # Verifica versão do next
  NEXT_VER=$(node -e "const p=require('./$FRONTEND_DIR/package.json'); console.log(p.dependencies?.next || 'não definido')" 2>/dev/null || echo "erro")
  detail "Next.js: $NEXT_VER"
else
  fail "package.json não encontrado em frontend/"
  fix "Verifique se rodou: bash scripts/create_frontend.sh"
fi

# node_modules
if [ -d "$FRONTEND_DIR/node_modules" ]; then
  MODULE_COUNT=$(ls "$FRONTEND_DIR/node_modules" | wc -l)
  pass "node_modules: $MODULE_COUNT pacotes instalados"
else
  fail "node_modules não encontrado — dependências não instaladas"
  fix "Rode: cd frontend && npm install"
fi

# .env.local
if [ -f "$FRONTEND_DIR/.env.local" ]; then
  pass ".env.local encontrado"
  API_URL=$(grep NEXT_PUBLIC_API_URL "$FRONTEND_DIR/.env.local" 2>/dev/null | cut -d'=' -f2)
  if [ -n "$API_URL" ]; then
    pass "NEXT_PUBLIC_API_URL=$API_URL"
    # Testa se a URL do .env.local responde
    API_HEALTH=$(curl -sf --max-time 5 "${API_URL%/v1}/health" 2>/dev/null || \
                 curl -sf --max-time 5 "$API_URL/../health" 2>/dev/null || echo "FAIL")
    if echo "$API_HEALTH" | grep -q '"ok"'; then
      pass "API URL acessível pelo frontend"
    else
      warn "API URL ($API_URL) pode não estar acessível"
      fix "Verifique se o Flask está rodando: docker compose up -d api"
    fi
  else
    warn "NEXT_PUBLIC_API_URL não definida no .env.local"
    fix "Adicione: echo 'NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1' >> frontend/.env.local"
  fi
else
  fail ".env.local não encontrado"
  fix "Crie: echo 'NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1' > frontend/.env.local"
fi

# Arquivos críticos do Next.js
echo ""
info "Arquivos críticos:"
CRITICAL_FILES=(
  "$FRONTEND_DIR/next.config.ts"
  "$FRONTEND_DIR/tailwind.config.ts"
  "$FRONTEND_DIR/postcss.config.js"
  "$FRONTEND_DIR/tsconfig.json"
  "$FRONTEND_DIR/src/app/layout.tsx"
  "$FRONTEND_DIR/src/app/globals.css"
  "$FRONTEND_DIR/src/app/providers.tsx"
  "$FRONTEND_DIR/src/middleware.ts"
  "$FRONTEND_DIR/src/app/(auth)/login/page.tsx"
  "$FRONTEND_DIR/src/app/(student)/dashboard/page.tsx"
  "$FRONTEND_DIR/src/lib/api/client.ts"
  "$FRONTEND_DIR/src/lib/stores/authStore.ts"
)

MISSING_FILES=0
for f in "${CRITICAL_FILES[@]}"; do
  if [ -f "$f" ]; then
    SIZE=$(wc -c < "$f" 2>/dev/null || echo "0")
    if [ "${SIZE:-0}" -lt 10 ]; then
      warn "$f — arquivo vazio (apenas stub)"
    else
      pass "${f#frontend/} (${SIZE}b)"
    fi
  else
    fail "$f — NÃO encontrado"
    MISSING_FILES=$((MISSING_FILES+1))
  fi
done

if [ "$MISSING_FILES" -gt 0 ]; then
  fix "Arquivos faltando: execute o bloco de código correspondente da conversa para criar"
fi

# Next.js processo
echo ""
info "Processo Next.js:"
NEXT_PID=$(pgrep -f "next dev\|next start\|next-server" 2>/dev/null | head -1 || echo "")
if [ -n "$NEXT_PID" ]; then
  pass "Next.js rodando (PID: $NEXT_PID)"
  # Qual porta?
  NEXT_PORT=$(ss -tlnp 2>/dev/null | grep "$NEXT_PID" | awk '{print $4}' | grep -oE '[0-9]+$' | head -1 || echo "?")
  detail "Porta: ${NEXT_PORT:-3000}"
else
  warn "Next.js NÃO está rodando"
  fix "Inicie: cd frontend && npm run dev -- -H 0.0.0.0 -p 3000"
fi

# Verifica erros de compilação no cache
if [ -d "$FRONTEND_DIR/.next" ]; then
  pass ".next/ (cache de build existe)"
  BUILD_ERR=$(find "$FRONTEND_DIR/.next" -name "*.log" 2>/dev/null | xargs grep -l "error" 2>/dev/null | head -1)
  if [ -n "$BUILD_ERR" ]; then
    warn "Erros encontrados em: $BUILD_ERR"
    tail -20 "$BUILD_ERR" | sed 's/^/    /'
  fi
else
  info ".next/ não existe (primeira execução)"
fi

# ══════════════════════════════════════════════════════════════════════════════
section "6. REDE E PORTAS"
# ══════════════════════════════════════════════════════════════════════════════

info "Portas em uso:"
declare -A EXPECTED_PORTS=(
  ["3000"]="Next.js Frontend"
  ["5000"]="Flask API"
  ["5432"]="PostgreSQL"
  ["6379"]="Redis"
  ["5555"]="Flower (Celery)"
)

for port in "${!EXPECTED_PORTS[@]}"; do
  service="${EXPECTED_PORTS[$port]}"
  if ss -tlnp 2>/dev/null | grep -q ":$port " || \
     netstat -tlnp 2>/dev/null | grep -q ":$port " || \
     curl -sf --max-time 2 "http://localhost:$port" >/dev/null 2>&1; then
    pass "Porta $port: $service — em uso ✓"
  else
    warn "Porta $port: $service — NÃO está em uso"
    case $port in
      "3000") fix "Inicie o frontend: cd frontend && npm run dev -- -H 0.0.0.0 -p 3000" ;;
      "5000") fix "Inicie o backend: docker compose up -d api" ;;
      "5432") fix "Inicie o banco: docker compose up -d postgres" ;;
      "6379") fix "Inicie o Redis: docker compose up -d redis" ;;
    esac
  fi
done

# Conectividade entre serviços
echo ""
info "Conectividade entre serviços:"

# API → Banco
API_TO_DB=$(curl -sf --max-time 5 "http://localhost:5000/health/ready" 2>/dev/null || echo "FAIL")
if echo "$API_TO_DB" | grep -q '"ready"'; then
  pass "API → Banco: conectado"
else
  fail "API → Banco: não conectado"
fi

# Frontend → API (CORS)
if command -v curl >/dev/null 2>&1; then
  CORS_RESP=$(curl -sf --max-time 5 -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: GET" \
    -X OPTIONS "http://localhost:5000/api/v1/auth/login" 2>/dev/null || echo "FAIL")
  if [ "$CORS_RESP" != "FAIL" ]; then
    pass "CORS: API aceita requisições do frontend"
  else
    warn "CORS: não foi possível verificar"
  fi
fi

# Codespaces: verifica se a porta está pública
if [ "$IS_CODESPACES" = true ]; then
  echo ""
  info "GitHub Codespaces — portas:"
  if command -v gh >/dev/null 2>&1; then
    gh codespace ports 2>/dev/null | sed 's/^/  /' || detail "Não foi possível listar portas via gh CLI"
  else
    warn "gh CLI não disponível — verifique portas na aba PORTS do VS Code"
    fix "Na aba PORTS: clique com botão direito na porta 3000 → 'Port Visibility' → 'Public'"
    fix "Na aba PORTS: clique com botão direito na porta 5000 → 'Port Visibility' → 'Public'"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
section "7. ARQUIVOS DE CONFIGURAÇÃO"
# ══════════════════════════════════════════════════════════════════════════════

info ".env:"
if [ -f ".env" ]; then
  pass ".env existe"
  # Verifica variáveis críticas sem mostrar valores
  for var in POSTGRES_PASSWORD REDIS_PASSWORD SECRET_KEY JWT_SECRET_KEY; do
    VAL=$(grep "^${var}=" .env 2>/dev/null | cut -d'=' -f2)
    if [ -z "$VAL" ]; then
      warn "$var: não definida no .env"
      fix "Adicione $var ao .env"
    elif echo "$VAL" | grep -qi "TROQUE\|change\|example\|your_key"; then
      warn "$var: ainda tem valor de exemplo"
    else
      pass "$var: definida"
    fi
  done
else
  fail ".env não encontrado"
  fix "Copie: cp .env.example .env"
fi

echo ""
info "docker-compose.yml:"
if [ -f "docker-compose.yml" ]; then
  pass "docker-compose.yml existe"
  # Valida sintaxe
  if docker compose config >/dev/null 2>&1; then
    pass "docker-compose.yml: sintaxe válida"
  else
    fail "docker-compose.yml: erro de sintaxe"
    docker compose config 2>&1 | head -20 | sed 's/^/  /'
    fix "Corrija os erros de sintaxe no docker-compose.yml"
  fi
else
  fail "docker-compose.yml não encontrado"
fi

echo ""
info "API — Arquivos Python críticos:"
PYTHON_FILES=(
  "api/app.py"
  "api/app/__init__.py"
  "api/app/config.py"
  "api/app/extensions.py"
  "api/app/middleware/tenant.py"
  "api/app/models/__init__.py"
  "api/app/models/tenant.py"
  "api/app/models/user.py"
  "api/app/routes/auth.py"
  "api/app/routes/courses.py"
  "api/app/routes/questions.py"
  "api/app/routes/analytics.py"
  "api/app/routes/schedule.py"
  "api/app/routes/simulados.py"
  "api/app/services/schedule_engine.py"
  "api/seed.py"
  "api/requirements.txt"
)

for f in "${PYTHON_FILES[@]}"; do
  if [ -f "$f" ]; then
    SIZE=$(wc -l < "$f" 2>/dev/null || echo "0")
    if [ "${SIZE:-0}" -lt 3 ]; then
      warn "$f — apenas stub (${SIZE} linhas)"
    else
      pass "$f (${SIZE} linhas)"
    fi
  else
    fail "$f — NÃO encontrado"
  fi
done

# ══════════════════════════════════════════════════════════════════════════════
section "8. ERROS DE COMPILAÇÃO — TypeScript / Next.js"
# ══════════════════════════════════════════════════════════════════════════════

if [ -d "$FRONTEND_DIR" ] && [ -d "$FRONTEND_DIR/node_modules" ]; then
  info "Verificando TypeScript..."

  # Roda type-check
  TS_OUTPUT=$(cd "$FRONTEND_DIR" && npx tsc --noEmit 2>&1 || true)
  TS_ERRORS=$(echo "$TS_OUTPUT" | grep -c "error TS" 2>/dev/null || echo "0")

  if [ "${TS_ERRORS:-0}" -eq 0 ]; then
    pass "TypeScript: sem erros"
  else
    fail "TypeScript: $TS_ERRORS erro(s) encontrado(s)"
    echo "$TS_OUTPUT" | grep "error TS" | head -20 | sed 's/^/  /'
    fix "Corrija os erros TypeScript antes de buildar"
  fi

  # Verifica next.config
  if [ -f "$FRONTEND_DIR/next.config.ts" ] || [ -f "$FRONTEND_DIR/next.config.js" ]; then
    pass "next.config: encontrado"
  else
    warn "next.config não encontrado"
    fix "Crie o frontend/next.config.ts conforme o código da conversa"
  fi

  # Imports críticos
  info "Verificando imports críticos nos arquivos..."
  IMPORT_ERRORS=0

  check_import() {
    local file="$FRONTEND_DIR/$1"
    local import="$2"
    if [ -f "$file" ] && ! grep -q "$import" "$file" 2>/dev/null; then
      warn "$1: import '$import' não encontrado"
      IMPORT_ERRORS=$((IMPORT_ERRORS+1))
    fi
  }

  check_import "src/app/providers.tsx"         "QueryClientProvider"
  check_import "src/lib/api/client.ts"         "axios"
  check_import "src/lib/stores/authStore.ts"   "zustand"
  check_import "src/lib/theme/ThemeProvider.tsx" "useTenantStore"

  if [ "$IMPORT_ERRORS" -eq 0 ]; then
    pass "Imports críticos: ok"
  fi
else
  warn "TypeScript check pulado — node_modules não instalado"
  fix "Rode: cd frontend && npm install"
fi

# ══════════════════════════════════════════════════════════════════════════════
section "9. PROBLEMA ESPECÍFICO — PORT FORWARDING (CODESPACES)"
# ══════════════════════════════════════════════════════════════════════════════

if [ "$IS_CODESPACES" = true ]; then
  info "Diagnóstico de 'Error forwarding port':"
  echo ""

  # Causa 1: Next.js não está rodando
  if ! pgrep -f "next" >/dev/null 2>&1; then
    fail "Causa provável: Next.js NÃO está rodando"
    fix "cd frontend && npm run dev -- -H 0.0.0.0 -p 3000"
  else
    pass "Next.js está rodando"
  fi

  # Causa 2: Escutando em 127.0.0.1 ao invés de 0.0.0.0
  LISTENING=$(ss -tlnp 2>/dev/null | grep ":3000" || netstat -tlnp 2>/dev/null | grep ":3000" || echo "")
  if echo "$LISTENING" | grep -q "127.0.0.1:3000"; then
    fail "Causa provável: Next.js escutando em 127.0.0.1 (não acessível pelo Codespaces)"
    fix "Rode com: npm run dev -- -H 0.0.0.0 -p 3000"
    fix "Ou adicione no package.json: \"dev\": \"next dev -H 0.0.0.0 -p 3000\""
  elif echo "$LISTENING" | grep -q "0.0.0.0:3000\|:::3000"; then
    pass "Next.js escutando em 0.0.0.0 (correto)"
  fi

  # Causa 3: Porta não é pública no Codespaces
  warn "Verifique: porta 3000 precisa estar 'Public' no painel PORTS"
  info "Como verificar:"
  detail "1. Clique na aba 'PORTS' no VS Code"
  detail "2. Encontre a linha com porta 3000"
  detail "3. Botão direito → 'Port Visibility' → 'Public'"
  detail "4. Acesse pela URL gerada pelo Codespaces (não localhost)"

  # URL do Codespaces
  if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
    CODESPACE_URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    info "URL esperada do frontend: $CODESPACE_URL"
    FE_STATUS=$(curl -sf --max-time 10 "$CODESPACE_URL" 2>/dev/null | head -c 100 || echo "FAIL")
    if [ "$FE_STATUS" != "FAIL" ]; then
      pass "Frontend acessível em: $CODESPACE_URL"
    else
      warn "Frontend não acessível em: $CODESPACE_URL (verifique se está Public)"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
section "10. PERFORMANCE E RECURSOS DOS CONTAINERS"
# ══════════════════════════════════════════════════════════════════════════════

info "Uso de recursos (containers rodando):"
RUNNING=$(docker ps --format "{{.Names}}" 2>/dev/null | grep -E "concurso|whitelabel" || echo "")

if [ -n "$RUNNING" ]; then
  echo ""
  printf "  %-25s %-10s %-20s %-15s\n" "Container" "CPU" "Memória" "Uptime"
  echo "  $(printf '─%.0s' {1..70})"

  docker stats --no-stream --format \
    "  {{printf \"%-25s\" .Name}} {{printf \"%-10s\" .CPUPerc}} {{printf \"%-20s\" .MemUsage}} {{.RunningFor}}" \
    $RUNNING 2>/dev/null || detail "Não foi possível obter stats"
else
  warn "Nenhum container do projeto rodando"
fi

# ══════════════════════════════════════════════════════════════════════════════
section "11. GIT"
# ══════════════════════════════════════════════════════════════════════════════

if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "desconhecida")
  LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "sem commits")
  MODIFIED=$(git status --short 2>/dev/null | wc -l | tr -d ' ')

  pass "Branch: $branch"
  pass "Último commit: $LAST_COMMIT"

  if [ "${MODIFIED:-0}" -gt 0 ]; then
    warn "$MODIFIED arquivo(s) modificado(s) sem commit"
    git status --short 2>/dev/null | head -10 | sed 's/^/  /'
    fix "Commit suas alterações: git add -A && git commit -m 'wip: salva progresso'"
  else
    pass "Working tree limpo"
  fi
else
  warn "Git: não é um repositório ou git não disponível"
fi

# ══════════════════════════════════════════════════════════════════════════════
section "RESUMO FINAL"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${BOLD}${GREEN}  ✓ Tudo funcionando perfeitamente!${NC}"
else
  if [ $ERRORS -gt 0 ]; then
    echo -e "${BOLD}${RED}  ✗ $ERRORS ERRO(S) ENCONTRADO(S):${NC}"
    for i in "${!ERROR_LIST[@]}"; do
      echo -e "  ${RED}  $((i+1)). ${ERROR_LIST[$i]}${NC}"
    done
    echo ""
  fi

  if [ $WARNINGS -gt 0 ]; then
    echo -e "${BOLD}${YELLOW}  ⚠ $WARNINGS AVISO(S):${NC}"
    for i in "${!WARNING_LIST[@]}"; do
      echo -e "  ${YELLOW}  $((i+1)). ${WARNING_LIST[$i]}${NC}"
    done
    echo ""
  fi
fi

if [ $FIXES -gt 0 ]; then
  echo -e "${BOLD}${MAGENTA}  🔧 $FIXES CORREÇÃO(ÕES) SUGERIDA(S):${NC}"
  for i in "${!FIX_LIST[@]}"; do
    echo -e "  ${MAGENTA}  $((i+1)).${NC} ${FIX_LIST[$i]}"
  done
  echo ""
fi

# Comando de correção automática
echo -e "${BOLD}  Quer tentar corrigir tudo automaticamente?${NC}"
echo -e "  ${DIM}bash scripts/fix.sh${NC}"
echo ""
echo -e "  ${DIM}Log completo salvo em: $LOG_FILE${NC}"
echo ""