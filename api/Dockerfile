# api/Dockerfile
# Imagem multistage: base para dev com hot-reload

FROM python:3.12-slim AS base

# SEGURANÇA: Não rode como root
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

# Dependências de sistema (mínimas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Instala dependências Python antes de copiar código (cache de layers)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# SEGURANÇA: Muda para usuário não-root antes de qualquer execução
USER appuser

# Em dev, o código é montado via volume (não copiado aqui)
# Em produção, adicionar: COPY --chown=appuser:appgroup . .

EXPOSE 5000

# Dev: Flask com hot-reload | Prod: substituir por Gunicorn no ECS task definition
CMD ["flask", "--app", "app", "run", "--host=0.0.0.0", "--port=5000", "--debug"]