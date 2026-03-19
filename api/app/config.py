# api/app/config.py
# Configurações centralizadas da aplicação.
# SEGURANÇA: Todos os valores sensíveis vêm de variáveis de ambiente, nunca hardcoded.

import os
from datetime import timedelta


class Config:
    """Configuração base compartilhada por todos os ambientes."""

    # ── Banco de Dados ───────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    # SEGURANÇA: Desabilita tracking de modificações (overhead + vazamento de memória)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Pool de conexões: evita conexões ociosas no RDS
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,       # Testa conexão antes de usar
        "pool_recycle": 300,         # Recicla conexões a cada 5min
        "pool_size": 10,
        "max_overflow": 20,
    }

    # ── Segurança Flask ──────────────────────────────────────────────────────
    SECRET_KEY = os.environ.get("SECRET_KEY")
    # SEGURANÇA: Verifica se a chave foi definida (falha rápida em dev descuidado)
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY não definida no ambiente!")

    # ── JWT ──────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    if not JWT_SECRET_KEY:
        raise ValueError("JWT_SECRET_KEY não definida no ambiente!")

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)       # Token curto
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)      # Refresh longo
    JWT_ALGORITHM = "HS256"
    # SEGURANÇA: Tokens ficam no header Authorization, nunca em cookies sem httpOnly
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    # ── Redis / Celery ───────────────────────────────────────────────────────
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
    # SEGURANÇA: Serializa tarefas como JSON (nunca pickle em produção)
    CELERY_TASK_SERIALIZER = "json"
    CELERY_RESULT_SERIALIZER = "json"
    CELERY_ACCEPT_CONTENT = ["json"]

    # ── Rate Limiting ────────────────────────────────────────────────────────
    # SEGURANÇA: Limita requisições por IP via Redis para prevenir brute-force
    RATELIMIT_STORAGE_URI = REDIS_URL
    RATELIMIT_DEFAULT = "200 per hour"
    RATELIMIT_HEADERS_ENABLED = True     # Retorna headers X-RateLimit-*

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Origens permitidas são definidas por tenant (ver middleware/tenant.py)
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
    # SEGURANÇA: Em dev, log de queries SQL ajuda a detectar N+1 e queries inseguras
    SQLALCHEMY_ECHO = False  # True para ver SQL no terminal (verboso)
    # Rate limit mais permissivo em dev para não atrapalhar testes
    RATELIMIT_DEFAULT = "10000 per hour"


class ProductionConfig(Config):
    """Configuração para produção na AWS."""

    DEBUG = False
    TESTING = False
    # SEGURANÇA: Force HTTPS verificando headers do ALB/CloudFront
    PREFERRED_URL_SCHEME = "https"
    # SEGURANÇA: Headers de segurança HTTP (complementa Nginx/CloudFront)
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"


class TestingConfig(Config):
    """Configuração para testes automatizados."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"  # BD em memória para testes rápidos
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
    RATELIMIT_ENABLED = False  # Desabilita rate limit nos testes


# Mapa de ambientes para a factory do Flask
config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False
    RATELIMIT_ENABLED = False
    JWT_SECRET_KEY = "test-jwt-secret-key"
    SECRET_KEY = "test-secret-key"
    CELERY_TASK_ALWAYS_EAGER = True   # Tasks executam sincronamente
    MAIL_SUPPRESS_SEND = True

config_by_name = {
    "development": DevelopmentConfig,
    "production":  ProductionConfig,
    "testing":     TestingConfig,     # ← adiciona esta linha
}