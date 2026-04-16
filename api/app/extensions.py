# api/app/extensions.py
import os
import logging
import ssl

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
limiter = Limiter(key_func=get_remote_address)
cors = CORS()
mail = Mail()
celery_app = Celery(__name__)
celery_app.conf.include = ["app.tasks"]


def _create_redis_client():
    url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    kwargs = {
        "decode_responses": True,
        "socket_connect_timeout": 5,
        "socket_timeout": 5,
        "retry_on_timeout": True,
    }

    if url.startswith("rediss://"):
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        kwargs["ssl_context"] = ssl_context

    client = redis.from_url(url, **kwargs)

    try:
        client.ping()
        logger.info("[Redis] Conexão estabelecida com sucesso")
    except Exception as e:
        logger.warning(f"[Redis] Ping falhou no startup: {type(e).__name__}: {e}")

    return client


redis_client = _create_redis_client()