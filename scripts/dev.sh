#!/bin/bash
# scripts/dev.sh
# Sobe backend + frontend em paralelo com logs organizados.
# Uso: bash scripts/dev.sh

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Concurso Platform — Dev Server     ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ── Variáveis de ambiente ──────────────────────────────────────────────────
export DOCKER_API_VERSION=1.43

# ── 1. Backend ────────────────────────────────────────────────────────────
echo -e "${CYAN}[BACKEND]${NC} Subindo serviços Docker..."

docker compose up -d 2>/dev/null

# Aguarda API responder
echo -e "${CYAN}[BACKEND]${NC} Aguardando Flask API..."
MAX=30
COUNT=0
until curl -sf http://localhost:5000/health > /dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX ]; then
    echo -e "${YELLOW}[WARN]${NC} Flask não respondeu em ${MAX}s"
    echo "Logs da API:"
    docker compose logs api --tail=15
    break
  fi
  printf "."
  sleep 1
done
echo ""
echo -e "${GREEN}[BACKEND]${NC} API rodando em http://localhost:5000"

# ── 2. Verificação do banco ────────────────────────────────────────────────
echo -e "${CYAN}[BACKEND]${NC} Verificando migrations..."
TABLES=$(docker exec concurso_postgres psql -U concurso_user -d concurso_platform \
  -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
  2>/dev/null | tr -d ' \n' || echo "0")

if [ "$TABLES" -lt 5 ] 2>/dev/null; then
  echo -e "${YELLOW}[BACKEND]${NC} Rodando migrations..."
  docker compose run --rm api flask db upgrade 2>/dev/null || true
  echo -e "${GREEN}[BACKEND]${NC} Migrations aplicadas"
else
  echo -e "${GREEN}[BACKEND]${NC} Banco ok ($TABLES tabelas)"
fi

# ── 3. Frontend ────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[FRONTEND]${NC} Iniciando Next.js..."
echo ""

if [ ! -d "frontend/node_modules" ]; then
  echo -e "${YELLOW}[FRONTEND]${NC} Instalando dependências..."
  cd frontend && npm install --silent && cd ..
fi

if [ ! -f "frontend/.env.local" ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1" > frontend/.env.local
  echo -e "${GREEN}[FRONTEND]${NC} .env.local criado"
fi

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Ambiente pronto!                   ║"
echo "  ╠══════════════════════════════════════╣"
echo "  ║  Frontend  → http://localhost:3000   ║"
echo "  ║  Backend   → http://localhost:5000   ║"
echo "  ║  Flower    → http://localhost:5555   ║"
echo "  ╠══════════════════════════════════════╣"
echo "  ║  Login:  aluno@teste.com             ║"
echo "  ║  Senha:  Aluno@123456                ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# Inicia o frontend (este processo fica em foreground)
cd frontend && npm run dev