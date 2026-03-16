from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models import User

users_bp = Blueprint("users", __name__, url_prefix="/users")


@users_bp.route("", methods=["GET"])
def list_users():
    users = User.query.order_by(User.id.asc()).all()
    return jsonify([user.to_dict() for user in users]), 200


@users_bp.route("", methods=["POST"])
def create_user():
    data = request.get_json(silent=True) or {}
    name = data.get("name")

    if not name or not isinstance(name, str) or not name.strip():
        return jsonify({
            "error": "validation_error",
            "message": "O campo 'name' é obrigatório."
        }), 400

    user = User(name=name.strip())
    db.session.add(user)
    db.session.commit()

    return jsonify(user.to_dict()), 201