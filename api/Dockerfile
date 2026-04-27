# api/Dockerfile
# Apenas o stage de production é alterado.
# O stage base e development permanecem iguais.

FROM python:3.12-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS production

RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/bash appuser

COPY --chown=appuser:appgroup . .
USER appuser

EXPOSE 5000

# ANTES:
#   gunicorn --workers 4 --threads 2 --timeout 120 --preload wsgi:app
#
# PROBLEMAS:
#   1. --workers 4 → apenas 4×2=8 slots concorrentes → ConnectionRefused sob 1.000 users
#   2. --timeout 120 → requests ficavam 2 min pendurados → fila explodia no ramp-up (P95=82s)
#   3. --preload sem post_fork → workers herdavam pool do master → 2.713 ConnectionRefused
#
# DEPOIS:
#   gunicorn.conf.py centraliza toda a config e resolve os 3 problemas:
#   1. workers = (2 × CPU) + 1, sobrescrevível via WEB_CONCURRENCY
#   2. timeout = 30s (configurável via GUNICORN_TIMEOUT)
#   3. post_fork() descarta pool herdado → cada worker cria suas próprias conexões
CMD ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:app"]