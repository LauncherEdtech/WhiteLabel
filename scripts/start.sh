#!/bin/bash
# scripts/start.sh
# Script principal: sobe o ambiente e verifica se está tudo ok.
# Uso: bash scripts/start.sh [--build] [--seed] [--reset]
#
# Flags:
#   --build   força rebuild das imagens
#   --seed    roda o seed após subir
#   --reset   apaga volumes e recria tudo do zero

set -euo pipefail

# ── Cores para output ──────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Flags ──────────────────────────────────────────────────
BUILD=false
SEED=false
RESET=false

for arg in "$@"; do
  case $arg in
    --build) BUILD=true ;;
    --seed)  SEED=true  ;;
    --reset) RESET=true ;;
  esac
done

# ── Funções auxiliares ─────────────────────────────────────
log()     { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERRO]${NC}  $1"; }
section() { echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}\n"; }

# ── Início ─────────────────────────────────────────────────
clear
echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   Concurso Platform — Dev Environment ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ── Pré-requisitos ─────────────────────────────────────────
section "Verificando pré-requisitos"

command -v docker >/dev/null 2>&1 || { error "Docker não encontrado!"; exit 1; }
ok "Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"

command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 \
  || { error "Docker Compose não encontrado!"; exit 1; }
ok "Docker Compose: $(docker compose version --short 2>/dev/null || echo 'ok')"

# Verifica se .env existe
if [ ! -f .env ]; then
  warn ".env não encontrado — criando a partir do .env.example..."
  cp .env.example .env
  ok ".env criado"
else
  ok ".env encontrado"
fi

# ── Reset (opcional) ───────────────────────────────────────
if [ "$RESET" = true ]; then
  section "Reset completo"
  warn "Apagando containers e volumes..."
  docker compose down -v --remove-orphans 2>/dev/null || true
  ok "Ambiente resetado"
fi

# ── Build ──────────────────────────────────────────────────
section "Build das imagens"

if [ "$BUILD" = true ]; then
  log "Rebuild forçado (--build)..."
  docker compose build --no-cache api
  ok "Build concluído"
else
  log "Build incremental (use --build para forçar rebuild)..."
  docker compose build api
  ok "Build concluído"
fi

# ── Subindo serviços ───────────────────────────────────────
section "Subindo serviços"

log "Iniciando postgres e redis primeiro..."
docker compose up -d postgres redis

# Aguarda postgres estar healthy
log "Aguardando PostgreSQL ficar pronto..."
MAX_WAIT=60
COUNT=0
until docker compose exec -T postgres pg_isready \
  -U "${POSTGRES_USER:-concurso_user}" \
  -d "${POSTGRES_DB:-concurso_platform}" \
  >/dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX_WAIT ]; then
    error "PostgreSQL não ficou pronto em ${MAX_WAIT}s!"
    docker compose logs postgres --tail=20
    exit 1
  fi
  printf "."
  sleep 1
done
echo ""
ok "PostgreSQL pronto"

# Aguarda redis estar healthy
log "Aguardando Redis ficar pronto..."
COUNT=0
until docker compose exec -T redis \
  redis-cli -a "${REDIS_PASSWORD:-redis_dev_pass}" ping \
  >/dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge 30 ]; then
    error "Redis não ficou pronto em 30s!"
    docker compose logs redis --tail=20
    exit 1
  fi
  printf "."
  sleep 1
done
echo ""
ok "Redis pronto"

# Sobe API e demais serviços
log "Subindo API, Celery e Flower..."
docker compose up -d api celery flower

# Aguarda API responder
log "Aguardando Flask API ficar pronto..."
COUNT=0
until curl -sf http://localhost:5000/health >/dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge 60 ]; then
    error "Flask API não ficou pronto em 60s!"
    echo ""
    error "Logs da API:"
    docker compose logs api --tail=30
    exit 1
  fi
  printf "."
  sleep 1
done
echo ""
ok "Flask API pronto"

# ── Migrations ─────────────────────────────────────────────
section "Migrations"

# Verifica se a pasta migrations existe
if [ ! -d "api/migrations" ]; then
  log "Inicializando migrations pela primeira vez..."
  docker compose run --rm api flask db init
  ok "Migrations inicializadas"
fi

log "Rodando migrações pendentes..."
docker compose run --rm api flask db migrate -m "auto" 2>/dev/null || true
docker compose run --rm api flask db upgrade
ok "Migrations aplicadas"

# ── Seed (opcional) ────────────────────────────────────────
if [ "$SEED" = true ]; then
  section "Seed de dados"
  log "Rodando seed..."
  docker compose run --rm api python seed.py
  ok "Seed concluído"
fi

# ── Verificação final ──────────────────────────────────────
section "Verificação final de saúde"

bash scripts/check.sh

# ── Resumo ─────────────────────────────────────────────────
section "Ambiente pronto!"

echo -e "  ${GREEN}Flask API${NC}   → http://localhost:5000"
echo -e "  ${GREEN}Health${NC}      → http://localhost:5000/health"
echo -e "  ${GREEN}Flower${NC}      → http://localhost:5555"
echo -e "  ${GREEN}PostgreSQL${NC}  → localhost:5432"
echo -e "  ${GREEN}Redis${NC}       → localhost:6379"
echo ""
echo -e "  ${YELLOW}Logs em tempo real:${NC}  docker compose logs -f api"
echo -e "  ${YELLOW}Parar tudo:${NC}          docker compose down"
echo -e "  ${YELLOW}Reset completo:${NC}      bash scripts/start.sh --reset --build --seed"
echo ""