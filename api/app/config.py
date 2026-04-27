# api/app/config.py
import os
from datetime import timedelta


class Config:

    # ── Banco de Dados ───────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": int(os.environ.get("SQLALCHEMY_POOL_SIZE", 10)),
        "max_overflow": int(os.environ.get("SQLALCHEMY_MAX_OVERFLOW", 20)),
    }    

    # ── Segurança Flask ──────────────────────────────────────────────────────
    SECRET_KEY = os.environ.get("SECRET_KEY")
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY não definida no ambiente!")

    # ── JWT ──────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    if not JWT_SECRET_KEY:
        raise ValueError("JWT_SECRET_KEY não definida no ambiente!")

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_ALGORITHM = "HS256"
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    # ── Redis ────────────────────────────────────────────────────────────────
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    _redis_url_clean = REDIS_URL.split("?")[0]
    _is_rediss = _redis_url_clean.startswith("rediss://")
    _redis_ssl_suffix = "?ssl_cert_reqs=CERT_NONE" if _is_rediss else ""

    # ── Celery Broker ────────────────────────────────────────────────────────
    CELERY_BROKER_URL = os.environ.get(
        "CELERY_BROKER_URL",
        _redis_url_clean + _redis_ssl_suffix,
    )

    # ── Celery Result Backend ────────────────────────────────────────────────
    _result_backend_raw = os.environ.get(
        "CELERY_RESULT_BACKEND",
        _redis_url_clean + _redis_ssl_suffix,
    )
    if _result_backend_raw.startswith("rediss://") and "ssl_cert_reqs" not in _result_backend_raw:
        _result_backend_raw += "?ssl_cert_reqs=CERT_NONE"
    CELERY_RESULT_BACKEND = _result_backend_raw

    CELERY_TASK_SERIALIZER = "json"
    CELERY_RESULT_SERIALIZER = "json"
    CELERY_ACCEPT_CONTENT = ["json"]

    # ── Rate Limiting ────────────────────────────────────────────────────────
    RATELIMIT_STORAGE_URI = _redis_url_clean
    RATELIMIT_STORAGE_OPTIONS = (
        {"ssl_cert_reqs": None}
        if _is_rediss
        else {}
    )
    RATELIMIT_DEFAULT = "100000  per hour"
    RATELIMIT_HEADERS_ENABLED = True

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_SUPPORTS_CREDENTIALS = True

    # ── IA ───────────────────────────────────────────────────────────────────
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

    # ── Storage ──────────────────────────────────────────────────────────────
    AWS_S3_BUCKET = os.environ.get("AWS_S3_BUCKET", "")
    AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

    # ── E-mail ───────────────────────────────────────────────────────────────
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "localhost")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "noreply@launcheredu.com.br")

    # ── Domínio da Plataforma ─────────────────────────────────────────────────
    # Usado para construir o link de reset de senha enviado por e-mail.
    # Link: https://{tenant.slug}.{PLATFORM_DOMAIN}/reset-password?token=...&tenant={slug}
    PLATFORM_DOMAIN = os.environ.get("PLATFORM_DOMAIN", "launcheredu.com.br")


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = False
    RATELIMIT_DEFAULT = "10000 per hour"


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False
    PREFERRED_URL_SCHEME = "https"
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"


class TestingConfig(Config):
    TESTING = True
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": False,
    }
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
    JWT_SECRET_KEY = "test-jwt-secret-key"
    SECRET_KEY = "test-secret-key"
    RATELIMIT_ENABLED = False
    WTF_CSRF_ENABLED = False
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
    # Evita conexão real ao Redis durante testes — tasks rodam inline (ALWAYS_EAGER)
    # e resultados ficam em memória, sem precisar de broker ou result backend externos.
    CELERY_RESULT_BACKEND = "cache+memory://"
    CELERY_CACHE_BACKEND = "memory"
    MAIL_SUPPRESS_SEND = True


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}