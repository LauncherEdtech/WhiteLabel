#!/bin/bash
# scripts/logs.sh
# Mostra logs dos serviços de forma organizada.
# Uso: bash scripts/logs.sh [api|postgres|redis|celery|all]

SERVICE=${1:-api}

case $SERVICE in
  all)
    docker compose logs -f --tail=50
    ;;
  api|postgres|redis|celery|flower)
    docker compose logs -f --tail=50 "$SERVICE"
    ;;
  *)
    echo "Uso: bash scripts/logs.sh [api|postgres|redis|celery|flower|all]"
    exit 1
    ;;
esac