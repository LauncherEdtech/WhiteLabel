# api/app/extensions.py
import os
import redis

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
def _create_redis_client():
    url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    try:
        client = redis.from_url(url, decode_responses=True, ssl_cert_reqs=None)
        client.ping()
        return client
    except Exception:
        return None


redis_client = _create_redis_client()
