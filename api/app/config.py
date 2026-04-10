# api/app/config.py
# Configurações centralizadas da aplicação.
# SEGURANÇA: Todos os valores sensíveis vêm de variáveis de ambiente, nunca hardcoded.
#
# BROKER CELERY:
#   Produção (ECS): CELERY_BROKER_URL=sqs:// → usa AWS SQS via IAM role
#   Dev (docker-compose): CELERY_BROKER_URL=redis://... → usa Redis local
#   A env var tem prioridade. Se não definida, constrói a partir de REDIS_URL.

import os
from datetime import timedelta


class Config:
    """Configuração base compartilhada por todos os ambientes."""

    # ── Banco de Dados ───────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": 10,
        "max_overflow": 20,
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
    # Usado para: rate limiting, cache dashboard/insights, activity tracker,
    # celery result backend. NÃO mais usado como Celery broker em produção.
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    _redis_ssl_suffix = (
        "?ssl_cert_reqs=CERT_NONE" if REDIS_URL.startswith("rediss://") else ""
    )

    # ── Celery Broker ────────────────────────────────────────────────────────
    # Produção: CELERY_BROKER_URL=sqs:// (definido na ECS task definition)
    # Dev local: CELERY_BROKER_URL=redis://... (definido no docker-compose)
    # Fallback: constrói a partir de REDIS_URL (compatibilidade)
    CELERY_BROKER_URL = os.environ.get(
        "CELERY_BROKER_URL",
        REDIS_URL + _redis_ssl_suffix,
    )

    # Result backend sempre no Redis (SQS não suporta result backend)
    CELERY_RESULT_BACKEND = os.environ.get(
        "CELERY_RESULT_BACKEND",
        REDIS_URL + _redis_ssl_suffix,
    )

    CELERY_TASK_SERIALIZER = "json"
    CELERY_RESULT_SERIALIZER = "json"
    CELERY_ACCEPT_CONTENT = ["json"]

    # ── Rate Limiting ────────────────────────────────────────────────────────
    RATELIMIT_STORAGE_URI = REDIS_URL
    RATELIMIT_DEFAULT = "200 per hour"
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
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "noreply@platform.com")


class DevelopmentConfig(Config):
    """Configuração para desenvolvimento local."""

    DEBUG = True
    SQLALCHEMY_ECHO = False
    RATELIMIT_DEFAULT = "10000 per hour"


class ProductionConfig(Config):
    """Configuração para produção na AWS."""

    DEBUG = False
    TESTING = False
    PREFERRED_URL_SCHEME = "https"
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"


class TestingConfig(Config):
    """Configuração para testes automatizados."""

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
    MAIL_SUPPRESS_SEND = True


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}
