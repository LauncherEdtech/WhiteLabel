from flask import Flask, jsonify

from app.config import Config
from app.extensions import db, migrate
from app.routes import register_blueprints


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    configure_extensions(app)
    configure_error_handlers(app)
    configure_security_headers(app)
    register_blueprints(app)

    return app


def configure_extensions(app: Flask) -> None:
    db.init_app(app)
    migrate.init_app(app, db)


def configure_error_handlers(app: Flask) -> None:
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            "error": "bad_request",
            "message": "Requisição inválida."
        }), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "error": "not_found",
            "message": "Recurso não encontrado."
        }), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            "error": "method_not_allowed",
            "message": "Método não permitido para este endpoint."
        }), 405

    @app.errorhandler(500)
    def internal_server_error(error):
        return jsonify({
            "error": "internal_server_error",
            "message": "Erro interno do servidor."
        }), 500


def configure_security_headers(app: Flask) -> None:
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data:; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'self'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        return response