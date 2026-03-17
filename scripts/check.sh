#!/bin/bash
# scripts/check.sh
# Diagnóstico completo do ambiente Docker.
# Uso: bash scripts/check.sh
# Pode ser rodado a qualquer momento para verificar o estado do ambiente.

set -uo pipefail

# ── Cores ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

pass()  { echo -e "  ${GREEN}✓${NC}  $1"; }
fail()  { echo -e "  ${RED}✗${NC}  $1"; ERRORS=$((ERRORS + 1)); }
warn()  { echo -e "  ${YELLOW}⚠${NC}  $1"; WARNINGS=$((WARNINGS + 1)); }
info()  { echo -e "  ${BLUE}→${NC}  $1"; }
title() { echo -e "\n${BOLD}${CYAN}$1${NC}"; echo "  $(printf '─%.0s' $(seq 1 40))"; }

echo ""
echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Diagnóstico — Concurso Platform      ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"

# ── 1. Docker ──────────────────────────────────────────────
title "1. Docker"

if command -v docker >/dev/null 2>&1; then
  pass "Docker instalado: $(docker --version | cut -d' ' -f3 | tr -d ',')"
else
  fail "Docker NÃO encontrado"
fi

if docker compose version >/dev/null 2>&1; then
  pass "Docker Compose disponível"
else
  fail "Docker Compose NÃO disponível"
fi

if docker info >/dev/null 2>&1; then
  pass "Docker daemon rodando"
else
  fail "Docker daemon NÃO está rodando"
fi

# ── 2. Containers ──────────────────────────────────────────
title "2. Containers"

check_container() {
  local name=$1
  local status
  status=$(docker inspect "$name" --format='{{.State.Status}}' 2>/dev/null || echo "not_found")

  case $status in
    "running")
      local health
      health=$(docker inspect "$name" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")
      if [ "$health" = "healthy" ] || [ "$health" = "none" ]; then
        pass "$name: running$([ "$health" != "none" ] && echo " (healthy)" || echo "")"
      elif [ "$health" = "starting" ]; then
        warn "$name: running (health ainda iniciando...)"
      else
        warn "$name: running mas health=$health"
      fi
      ;;
    "restarting")
      fail "$name: RESTARTING em loop"
      info "Últimos logs de $name:"
      docker logs "$name" --tail=10 2>&1 | sed 's/^/    /'
      ;;
    "exited")
      local exit_code
      exit_code=$(docker inspect "$name" --format='{{.State.ExitCode}}' 2>/dev/null || echo "?")
      fail "$name: EXITED (código $exit_code)"
      info "Últimos logs de $name:"
      docker logs "$name" --tail=10 2>&1 | sed 's/^/    /'
      ;;
    "not_found")
      fail "$name: container NÃO encontrado (não foi criado?)"
      ;;
    *)
      warn "$name: status=$status"
      ;;
  esac
}

check_container "concurso_postgres"
check_container "concurso_redis"
check_container "concurso_api"
check_container "concurso_celery"
check_container "concurso_flower"

# ── 3. Conectividade entre serviços ────────────────────────
title "3. Conectividade"

# PostgreSQL aceitando conexões
if docker exec concurso_postgres \
   pg_isready -U "${POSTGRES_USER:-concurso_user}" -d "${POSTGRES_DB:-concurso_platform}" \
   >/dev/null 2>&1; then
  pass "PostgreSQL aceitando conexões"
else
  fail "PostgreSQL NÃO aceitando conexões"
fi

# Redis respondendo PING
if docker exec concurso_redis \
   redis-cli -a "${REDIS_PASSWORD:-redis_dev_pass}" ping \
   >/dev/null 2>&1; then
  pass "Redis respondendo PING"
else
  fail "Redis NÃO respondendo"
fi

# API: /health
HEALTH_RESP=$(curl -sf --max-time 5 http://localhost:5000/health 2>/dev/null || echo "FAIL")
if echo "$HEALTH_RESP" | grep -q '"ok"'; then
  pass "Flask /health → ok"
else
  fail "Flask /health → $HEALTH_RESP"
fi

# API: /health/ready (testa conexão com banco pela API)
READY_RESP=$(curl -sf --max-time 5 http://localhost:5000/health/ready 2>/dev/null || echo "FAIL")
if echo "$READY_RESP" | grep -q '"ready"'; then
  pass "Flask /health/ready → ready (banco conectado)"
else
  fail "Flask /health/ready → $READY_RESP"
fi

# Flower
FLOWER_RESP=$(curl -sf --max-time 5 http://localhost:5555 2>/dev/null || echo "FAIL")
if [ "$FLOWER_RESP" != "FAIL" ]; then
  pass "Flower acessível em :5555"
else
  warn "Flower em :5555 não respondeu (pode estar iniciando)"
fi

# ── 4. Banco de dados ──────────────────────────────────────
title "4. Banco de Dados"

# Verifica tabelas criadas
TABLE_COUNT=$(docker exec concurso_postgres \
  psql -U "${POSTGRES_USER:-concurso_user}" \
       -d "${POSTGRES_DB:-concurso_platform}" \
       -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
  2>/dev/null | tr -d ' \n' || echo "0")

if [ "$TABLE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "Tabelas no banco: $TABLE_COUNT"
  # Lista as tabelas
  info "Tabelas criadas:"
  docker exec concurso_postgres \
    psql -U "${POSTGRES_USER:-concurso_user}" \
         -d "${POSTGRES_DB:-concurso_platform}" \
         -t -c "SELECT '    - ' || tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;" \
    2>/dev/null | grep -v '^$' | sed 's/^/  /'
else
  warn "Nenhuma tabela encontrada — rode: docker compose run --rm api flask db upgrade"
fi

# Verifica alembic_version (migrations)
MIGRATION=$(docker exec concurso_postgres \
  psql -U "${POSTGRES_USER:-concurso_user}" \
       -d "${POSTGRES_DB:-concurso_platform}" \
       -t -c "SELECT version_num FROM alembic_version LIMIT 1;" \
  2>/dev/null | tr -d ' \n' || echo "none")

if [ "$MIGRATION" != "none" ] && [ -n "$MIGRATION" ]; then
  pass "Migration aplicada: $MIGRATION"
else
  warn "Nenhuma migration aplicada"
fi

# ── 5. Arquivos críticos ────────────────────────────────────
title "5. Arquivos do Projeto"

check_file() {
  local path=$1
  if [ -f "$path" ]; then
    pass "$path"
  else
    fail "$path NÃO encontrado"
  fi
}

check_file ".env"
check_file "docker-compose.yml"
check_file "api/Dockerfile"
check_file "api/requirements.txt"
check_file "api/app.py"
check_file "api/app/__init__.py"
check_file "api/app/models/tenant.py"
check_file "api/app/routes/auth.py"
check_file "infra/postgres/init.sql"

# ── 6. Variáveis de ambiente críticas ─────────────────────
title "6. Variáveis de Ambiente"

check_env() {
  local var=$1
  local value
  value=$(grep "^${var}=" .env 2>/dev/null | cut -d'=' -f2 || echo "")

  if [ -z "$value" ]; then
    warn "$var não definida no .env (usando default)"
  elif echo "$value" | grep -qi "change\|troque\|example\|your_"; then
    warn "$var ainda tem valor de exemplo — troque antes de ir pra produção"
  else
    pass "$var definida"
  fi
}

check_env "POSTGRES_PASSWORD"
check_env "REDIS_PASSWORD"
check_env "SECRET_KEY"
check_env "JWT_SECRET_KEY"

# ── 7. Uso de recursos ─────────────────────────────────────
title "7. Uso de Recursos"

STATS=$(docker stats --no-stream --format \
  "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
  concurso_postgres concurso_redis concurso_api concurso_celery \
  2>/dev/null || echo "")

if [ -n "$STATS" ]; then
  echo "  Container              CPU      Memória"
  echo "  $(printf '─%.0s' $(seq 1 45))"
  echo "$STATS" | while IFS=$'\t' read -r name cpu mem; do
    printf "  %-22s %-8s %s\n" "$name" "$cpu" "$mem"
  done
fi

# ── Resultado final ────────────────────────────────────────
echo ""
echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${BOLD}${GREEN}║  ✓ Tudo funcionando perfeitamente!     ║${NC}"
elif [ $ERRORS -eq 0 ]; then
  echo -e "${BOLD}${YELLOW}║  ⚠ $WARNINGS aviso(s) — verifique acima  $(printf ' %.0s' $(seq 1 $((7 - ${#WARNINGS}))))║${NC}"
else
  echo -e "${BOLD}${RED}║  ✗ $ERRORS erro(s) encontrado(s)!         $(printf ' %.0s' $(seq 1 $((5 - ${#ERRORS}))))║${NC}"
fi

echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}Comandos úteis para depurar:${NC}"
  echo "  docker compose logs api --tail=50"
  echo "  docker compose logs postgres --tail=20"
  echo "  docker compose down && bash scripts/start.sh --build"
  echo ""
  exit 1
fi

echo ""