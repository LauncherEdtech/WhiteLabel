# api/app/routes/health.py
from flask import Blueprint, jsonify
from app.extensions import db, limiter
from sqlalchemy import text

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
@limiter.exempt
def health_check():
    """
    Health check básico para ECS e monitoramento.
    Isento do rate limiter — ECS chama a cada 30s (120x/hora por worker).
    """
    return jsonify({"status": "ok"}), 200


@health_bp.route("/health/ready", methods=["GET"])
@limiter.exempt
def readiness_check():
    """
    Readiness check: verifica conectividade com o banco de dados.
    """
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ready", "database": "ok"}), 200
    except Exception:
        return jsonify({"status": "not_ready", "database": "error"}), 503