# api/app/extensions.py
# Instâncias das extensões Flask criadas SEM a app (padrão Application Factory).
# Isso permite importar em qualquer módulo sem circular imports.

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
# SEGURANÇA: Usa IP real do cliente como chave de limite.
# Em produção atrás de ALB/CloudFront, ajustar para pegar X-Forwarded-For.
limiter = Limiter(key_func=get_remote_address)

# ── CORS ─────────────────────────────────────────────────────────────────────
cors = CORS()

# ── E-mail ───────────────────────────────────────────────────────────────────
mail = Mail()

# ── Celery (instância global, configurada na factory) ────────────────────────
celery_app = Celery(__name__)
celery_app.conf.include = ["app.tasks"]
