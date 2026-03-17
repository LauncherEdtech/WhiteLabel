#!/bin/bash
# .devcontainer/setup.sh
# Executado UMA VEZ após o devcontainer ser criado.
# Terminal aqui TEM acesso a docker, git, etc.

set -e

echo ""
echo "================================================"
echo "  Setup Codespaces — Concurso Platform"
echo "================================================"
echo ""

cd /workspaces/WhiteLabel

# ── Git ────────────────────────────────────────────────────
echo "→ Verificando Git..."
git --version
git config --global --add safe.directory /workspaces/WhiteLabel
echo "✓ Git ok"

# ── .env ──────────────────────────────────────────────────
echo ""
echo "→ Configurando .env..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ .env criado"
else
  echo "✓ .env já existe"
fi

# ── Permissões dos scripts ─────────────────────────────────
echo ""
echo "→ Configurando permissões..."
chmod +x scripts/start.sh scripts/check.sh scripts/logs.sh
echo "✓ Scripts prontos"

# ── Docker Compose: primeira subida ───────────────────────
echo ""
echo "→ Fazendo build das imagens (pode demorar na primeira vez)..."
docker compose build

echo ""
echo "→ Subindo serviços..."
docker compose up -d

echo ""
echo "→ Aguardando serviços ficarem prontos..."
sleep 10

# ── Migrations ────────────────────────────────────────────
echo ""
echo "→ Rodando migrations..."
if [ ! -d "api/migrations" ]; then
  docker compose run --rm api flask db init
fi
docker compose run --rm api flask db migrate -m "initial" 2>/dev/null || true
docker compose run --rm api flask db upgrade

# ── Seed ──────────────────────────────────────────────────
echo ""
echo "→ Rodando seed inicial..."
docker compose run --rm api python seed.py

echo ""
echo "================================================"
echo "  ✓ Ambiente pronto!"
echo ""
echo "  API:   http://localhost:5000"
echo "  Flower: http://localhost:5555"
echo ""
echo "  Ver logs:  docker compose logs -f api"
echo "  Verificar: bash scripts/check.sh"
echo "================================================"
echo ""

