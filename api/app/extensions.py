# api/app/extensions.py
import os
import redis

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from flask_mail import Mail
from celery import Celery

# ── Banco de Dados ───────────────────────────────────────────────────────────
db = SQLAlchemy()
migrate = Migrate()

# ── Auth ─────────────────────────────────────────────────────────────────────
jwt = JWTManager()

# ── Rate Limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── CORS ─────────────────────────────────────────────────────────────────────
cors = CORS()

# ── E-mail ───────────────────────────────────────────────────────────────────
mail = Mail()

# ── Celery ───────────────────────────────────────────────────────────────────
celery_app = Celery(__name__)
celery_app.conf.include = ["app.tasks"]


# ── Redis Cache ───────────────────────────────────────────────────────────────
import time as _time


class _InMemoryCache:
    """
    Cache em memória usado como fallback quando Redis não está disponível.
    Garante que o Gemini não seja chamado múltiplas vezes mesmo sem Redis.
    """
    def __init__(self):
        self._store: dict = {}

    def get(self, key: str):
        entry = self._store.get(key)
        if not entry:
            return None
        if _time.time() > entry["expires_at"]:
            del self._store[key]
            return None
        return entry["value"]

    def setex(self, key: str, ttl: int, value: str):
        self._store[key] = {
            "value": value,
            "expires_at": _time.time() + ttl,
        }

    def delete(self, key: str):
        self._store.pop(key, None)

    def ping(self):
        return True


def _create_redis_client():
    url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    try:
        client = redis.from_url(url, decode_responses=True, ssl_cert_reqs=None)
        client.ping()
        return client
    except Exception:
        # Redis indisponível: usa cache em memória como fallback
        return _InMemoryCache()


redis_client = _create_redis_client()
