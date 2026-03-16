from flask import Blueprint, jsonify
from sqlalchemy import text

from app.extensions import db

health_bp = Blueprint("health", __name__)


@health_bp.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Olá do Flask + PostgreSQL em container!"
    }), 200


@health_bp.route("/health", methods=["GET"])
def health():
    db_status = "up"

    try:
        db.session.execute(text("SELECT 1"))
    except Exception:
        db_status = "down"

    status_code = 200 if db_status == "up" else 503

    return jsonify({
        "status": "ok" if db_status == "up" else "degraded",
        "database": db_status
    }), status_code