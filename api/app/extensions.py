# api/app/extensions.py
import os
import ssl
import logging

import redis

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from flask_mail import Mail
from celery import Celery

logger = logging.getLogger(__name__)

# ── Banco de Dados ────────────────────────────────────────────────────────────
db = SQLAlchemy()
migrate = Migrate()

# ── Auth ──────────────────────────────────────────────────────────────────────
jwt = JWTManager()

# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── CORS ──────────────────────────────────────────────────────────────────────
cors = CORS()

# ── E-mail ────────────────────────────────────────────────────────────────────
mail = Mail()

# ── Celery ────────────────────────────────────────────────────────────────────
celery_app = Celery(__name__)
celery_app.conf.include = ["app.tasks"]


# ── Redis Cache ───────────────────────────────────────────────────────────────
def _create_redis_client():
    """
    Cria cliente Redis com suporte a Upstash (SSL autoassinado).

    FIX: versão anterior retornava None se ping() falhasse no startup,
    causando AttributeError silencioso em todo uso subsequente do cache.
    Agora sempre retorna um cliente configurado — erros de conexão são
    logados e capturados individualmente em cada operação de cache.
    """
    url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    # Upstash usa rediss:// com certificado autoassinado — CERT_NONE obrigatório
    client = redis.from_url(
        url,
        decode_responses=True,
        ssl_cert_reqs=ssl.CERT_NONE,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
    )

    # Testa conexão no startup — loga mas não bloqueia inicialização
    try:
        client.ping()
        logger.info("[Redis] Conexão estabelecida com sucesso")
    except Exception as e:
        logger.warning(
            f"[Redis] Ping falhou no startup: {type(e).__name__}: {e} — cache desabilitado até reconexão"
        )

    return client


redis_client = _create_redis_client()
