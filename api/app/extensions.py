# api/app/extensions.py
import os
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

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
mail = Mail()
celery_app = Celery(__name__)
celery_app.conf.include = ["app.tasks"]


def _get_rate_limit_key():
    from flask import request
    from flask_jwt_extended import decode_token
    try:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = decode_token(auth.split(" ")[1])
            return token.get("sub", get_remote_address())
    except Exception:
        pass
    return get_remote_address()


limiter = Limiter(key_func=_get_rate_limit_key)


def _create_redis_client():
    url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    client = redis.from_url(
        url,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
    )
    try:
        client.ping()
        logger.info("[Redis] Conexão estabelecida com sucesso")
    except Exception as e:
        logger.warning(f"[Redis] Ping falhou: {type(e).__name__}: {e}")
    return client


redis_client = _create_redis_client()