# api/app/routes/health.py
# Health check para ALB, ECS e monitoramento.
# SEGURANÇA: Não expõe informações internas — apenas status operacional.

from flask import Blueprint, jsonify
from app.extensions import db
from sqlalchemy import text

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health_check():
    """
    Health check básico para load balancer.
    Retorna 200 se o serviço está de pé.
    """
    return jsonify({"status": "ok"}), 200


@health_bp.route("/health/ready", methods=["GET"])
def readiness_check():
    """
    Readiness check: verifica se a API está pronta para receber tráfego.
    Testa conectividade com o banco de dados.
    """
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ready", "database": "ok"}), 200
    except Exception:
        # SEGURANÇA: Não expõe detalhes do erro de banco
        return jsonify({"status": "not_ready", "database": "error"}), 503