# api/app/__init__.py
# Application Factory: cria e configura o app Flask.
# SEGURANÇA: Padrão factory evita estado global e facilita testes isolados.

import os
import re
import logging

from flask import Flask, jsonify

from .config import config_by_name
from .extensions import db, migrate, jwt, limiter, cors, mail, celery_app


def create_app(config_name: str = None) -> Flask:
    """
    Cria e retorna a instância configurada do Flask.

    Args:
        config_name: 'development' | 'production' | 'testing'
                     Se None, lê FLASK_ENV do ambiente.
    """
    app = Flask(__name__)

    # ── 1. Configuração ───────────────────────────────────────────────────────
    env = config_name or os.environ.get("FLASK_ENV", "development")
    app.config.from_object(config_by_name[env])

    # ── 2. Logging estruturado ────────────────────────────────────────────────
    _configure_logging(app)

    # ── 3. Extensões ──────────────────────────────────────────────────────────
    _init_extensions(app)

    # ── 4. Registro de Blueprints (rotas) ─────────────────────────────────────
    _register_blueprints(app)

    # ── 5. Handlers de erro globais ───────────────────────────────────────────
    _register_error_handlers(app)

    # ── 6. Configuração Celery com contexto Flask ─────────────────────────────
    _configure_celery(app)

    app.logger.info(f"App iniciado em modo: {env}")
    return app


def _configure_logging(app: Flask) -> None:
    """
    Configura logging estruturado.
    SEGURANÇA: Em produção, logs devem ir para CloudWatch (sem dados sensíveis).
    """
    log_level = logging.DEBUG if app.config.get("DEBUG") else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


def _init_extensions(app: Flask) -> None:
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)

    # ── CORS ──────────────────────────────────────────────────────────────────
    # SEGURANÇA: Nunca usar "*" com supports_credentials=True (browsers rejeitam).
    # Lista explícita de origens permitidas:
    #   - Qualquer subdomínio de launcheredu.com.br (tenants)
    #   - O apex (admin, landing)
    #   - Localhost para desenvolvimento
    #
    # IMPORTANTE: ao adicionar um novo ambiente (staging, etc.),
    # adicione a origem aqui E na variável CORS_ORIGINS do ECS.

    allowed_origins = [
        # Subdomínios de produção: *.launcheredu.com.br
        re.compile(r"https://[a-z0-9\-]+\.launcheredu\.com\.br$"),
        # Apex
        "https://launcheredu.com.br",
        "https://www.launcheredu.com.br",
        # Desenvolvimento local
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # ALB direto (útil para health checks e testes internos)
        re.compile(r"http://.*\.elb\.amazonaws\.com$"),
    ]

    cors.init_app(
        app,
        resources={
            r"/*": {
                "origins": allowed_origins,
                "allow_headers": [
                    "Content-Type",
                    "Authorization",
                    "X-Tenant-Slug",
                    "X-Requested-With",
                ],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                # supports_credentials=True permite enviar JWT no header Authorization
                # a partir de origens específicas (não funciona com "*")
                "supports_credentials": True,
                "max_age": 3600,
            }
        },
    )

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"error": "token_expired", "message": "Token expirado."}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({"error": "invalid_token", "message": "Token inválido."}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return (
            jsonify(
                {"error": "authorization_required", "message": "Token necessário."}
            ),
            401,
        )

    from app.middleware.activity_tracker import track_user_activity

    @app.after_request
    def _track_activity(response):
        track_user_activity()
        return response


def _register_blueprints(app: Flask) -> None:
    """
    Registra todos os blueprints da API.
    Prefixo /api/v1 permite versionamento futuro sem breaking changes.
    """
    from .routes.health import health_bp
    from .routes.auth import auth_bp
    from .routes.tenants import tenants_bp
    from .routes.courses import courses_bp
    from .routes.questions import questions_bp
    from .routes.schedule import schedule_bp
    from .routes.simulados import simulados_bp
    from .routes.analytics import analytics_bp
    from .routes.admin_infra import admin_infra_bp
    from .routes.students import students_bp
    from .routes.uploads import uploads_bp
    from app.routes.gamification import gamification_bp
    from .routes.appearance import appearance_bp
    from .routes.producer_schedule import producer_schedule_bp
    from .routes.producer.questions import producer_questions_bp
    from .routes.admin.questions import admin_questions_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(tenants_bp, url_prefix="/api/v1/tenants")
    app.register_blueprint(courses_bp, url_prefix="/api/v1/courses")
    app.register_blueprint(questions_bp, url_prefix="/api/v1/questions")
    app.register_blueprint(schedule_bp, url_prefix="/api/v1/schedule")
    app.register_blueprint(simulados_bp, url_prefix="/api/v1/simulados")
    app.register_blueprint(analytics_bp, url_prefix="/api/v1/analytics")
    app.register_blueprint(admin_infra_bp, url_prefix="/api/v1/admin/infrastructure")
    app.register_blueprint(students_bp, url_prefix="/api/v1/students")
    app.register_blueprint(uploads_bp, url_prefix="/api/v1/uploads")
    app.register_blueprint(gamification_bp, url_prefix="/api/v1/gamification")
    app.register_blueprint(appearance_bp, url_prefix="/api/v1/appearance")
    app.register_blueprint(producer_schedule_bp, url_prefix="/api/v1/producer-schedule")
    app.register_blueprint(producer_questions_bp, url_prefix="/api/v1/producer")
    app.register_blueprint(admin_questions_bp, url_prefix="/api/v1/admin")


def _register_error_handlers(app: Flask) -> None:
    """
    Handlers globais de erro.
    SEGURANÇA: Respostas genéricas evitam vazamento de stack traces em produção.
    """

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "bad_request", "message": str(e)}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "unauthorized", "message": "Não autorizado."}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"error": "forbidden", "message": "Acesso negado."}), 403

    @app.errorhandler(404)
    def not_found(e):
        return (
            jsonify({"error": "not_found", "message": "Recurso não encontrado."}),
            404,
        )

    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        return (
            jsonify(
                {
                    "error": "rate_limit_exceeded",
                    "message": "Muitas requisições. Tente novamente.",
                }
            ),
            429,
        )

    @app.errorhandler(500)
    def internal_error(e):
        app.logger.error(f"Erro interno: {e}", exc_info=True)
        return (
            jsonify(
                {"error": "internal_error", "message": "Erro interno. Tente novamente."}
            ),
            500,
        )


def _configure_celery(app: Flask) -> None:
    """
    Configura Celery para rodar com contexto Flask.
    Necessário para tasks acessarem db, config, etc.
    """
    celery_app.conf.update(
        broker_url=app.config["CELERY_BROKER_URL"],
        result_backend=app.config["CELERY_RESULT_BACKEND"],
        task_serializer=app.config["CELERY_TASK_SERIALIZER"],
        result_serializer=app.config["CELERY_RESULT_SERIALIZER"],
        accept_content=app.config["CELERY_ACCEPT_CONTENT"],
        timezone="America/Sao_Paulo",
        enable_utc=True,
        include=["app.tasks"],
    )

    celery_app.conf.beat_schedule = {
        "nightly-schedule-check": {
            "task": "app.tasks.schedule_tasks.nightly_schedule_check",
            "schedule": 3 * 3600,
        },
        "publish-cloudwatch-metrics": {
            "task": "app.tasks.cloudwatch_metrics.publish_active_users_metric",
            "schedule": 60,
        },
    }

    class ContextTask(celery_app.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app.Task = ContextTask
