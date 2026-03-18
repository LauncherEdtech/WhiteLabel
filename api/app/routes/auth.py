# api/app/routes/auth.py
# Autenticação JWT: login, registro, refresh, logout, recuperação de senha.
# SEGURANÇA: Rate limiting agressivo em todas as rotas de auth.

import secrets
import hashlib
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE

from app.extensions import db, limiter
from app.models.user import User, UserRole
from app.middleware.tenant import resolve_tenant, require_tenant, get_current_tenant

auth_bp = Blueprint("auth", __name__)


# ── Schemas de Validação ───────────────────────────────────────────────────────


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=1, max=128))

    class Meta:
        unknown = EXCLUDE


class RegisterSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8, max=128))

    class Meta:
        unknown = EXCLUDE


class ForgotPasswordSchema(Schema):
    email = fields.Email(required=True)

    class Meta:
        unknown = EXCLUDE


class ResetPasswordSchema(Schema):
    token = fields.Str(required=True)
    new_password = fields.Str(required=True, validate=validate.Length(min=8, max=128))

    class Meta:
        unknown = EXCLUDE


# ── Helpers ────────────────────────────────────────────────────────────────────


def _create_tokens(user: User) -> tuple[str, str]:
    """
    Cria access_token e refresh_token para o usuário.

    SEGURANÇA:
    - Identity é apenas o user_id (string simples — mais compatível)
    - Dados extras (tenant_id, role) ficam em additional_claims
    - Esses claims são assinados junto com o token — não podem ser alterados
    """
    # Identity: apenas o user_id como string
    identity = user.id

    # Claims adicionais: assinados no token, verificados server-side
    additional_claims = {
        "tenant_id": user.tenant_id,
        "role": user.role.value,
    }

    access_token = create_access_token(
        identity=identity,
        additional_claims=additional_claims,
    )
    refresh_token = create_refresh_token(
        identity=identity,
        additional_claims=additional_claims,
    )
    return access_token, refresh_token


def _get_current_user_id() -> str:
    """Retorna o user_id do token JWT atual."""
    return get_jwt_identity()


def _get_token_claims() -> dict:
    """
    Retorna os claims adicionais do token atual.
    Use para acessar tenant_id e role sem ir ao banco.
    """
    return get_jwt()


def _hash_token(token: str) -> str:
    """Hash SHA-256 de tokens de reset/verificação."""
    return hashlib.sha256(token.encode()).hexdigest()


# ── Rotas ──────────────────────────────────────────────────────────────────────


@auth_bp.before_request
def before_request():
    resolve_tenant()


@auth_bp.route("/login", methods=["POST"])
@require_tenant
@limiter.limit("10 per minute")
def login():
    """
    Login com e-mail e senha.
    SEGURANÇA: Mensagem genérica — não revela se e-mail existe.
    """
    schema = LoginSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    tenant = get_current_tenant()
    GENERIC_ERROR = {
        "error": "invalid_credentials",
        "message": "E-mail ou senha inválidos.",
    }

    user = User.query.filter_by(
        email=data["email"].lower().strip(),
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    if not user or not user.is_active or not user.check_password(data["password"]):
        return jsonify(GENERIC_ERROR), 401

    access_token, refresh_token = _create_tokens(user)

    return (
        jsonify(
            {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "role": user.role.value,
                },
            }
        ),
        200,
    )


@auth_bp.route("/register", methods=["POST"])
@require_tenant
@limiter.limit("5 per minute")
def register():
    """Registro de novo aluno."""
    schema = RegisterSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    tenant = get_current_tenant()

    existing = User.query.filter_by(
        email=data["email"].lower().strip(),
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    if existing:
        return (
            jsonify(
                {
                    "error": "registration_failed",
                    "message": "Não foi possível completar o cadastro com este e-mail.",
                }
            ),
            409,
        )

    user = User(
        tenant_id=tenant.id,
        name=data["name"].strip(),
        email=data["email"].lower().strip(),
        role=UserRole.STUDENT,
        email_verified=False,
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Cadastro realizado. Verifique seu e-mail para ativar a conta.",
                "user_id": user.id,
            }
        ),
        201,
    )


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
@limiter.limit("30 per minute")
def refresh():
    """
    Renova o access_token usando o refresh_token.
    Mantém os mesmos claims do token original.
    """
    user_id = get_jwt_identity()
    claims = get_jwt()

    # Busca usuário para garantir que ainda está ativo
    user = User.query.filter_by(id=user_id, is_deleted=False).first()
    if not user or not user.is_active:
        return jsonify({"error": "user_inactive"}), 401

    additional_claims = {
        "tenant_id": claims.get("tenant_id"),
        "role": claims.get("role"),
    }

    new_access_token = create_access_token(
        identity=user_id,
        additional_claims=additional_claims,
    )
    return jsonify({"access_token": new_access_token}), 200


@auth_bp.route("/forgot-password", methods=["POST"])
@require_tenant
@limiter.limit("3 per minute")
def forgot_password():
    """
    Solicita recuperação de senha.
    SEGURANÇA: Sempre retorna 200, mesmo se e-mail não existe.
    """
    schema = ForgotPasswordSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    tenant = get_current_tenant()
    GENERIC_OK = {
        "message": "Se este e-mail estiver cadastrado, você receberá as instruções."
    }

    user = User.query.filter_by(
        email=data["email"].lower().strip(),
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    if not user:
        return jsonify(GENERIC_OK), 200

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    user.reset_token_hash = token_hash
    user.reset_token_expires_at = expires_at
    db.session.commit()

    # TODO: send_password_reset_email.delay(user.id, raw_token)

    return jsonify(GENERIC_OK), 200


@auth_bp.route("/reset-password", methods=["POST"])
@require_tenant
@limiter.limit("5 per minute")
def reset_password():
    """Redefine senha com token recebido por e-mail."""
    schema = ResetPasswordSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    GENERIC_ERROR = {"error": "invalid_token", "message": "Token inválido ou expirado."}
    token_hash = _hash_token(data["token"])

    user = User.query.filter_by(
        reset_token_hash=token_hash,
        is_deleted=False,
    ).first()

    if not user:
        return jsonify(GENERIC_ERROR), 400

    try:
        expires_at = datetime.fromisoformat(user.reset_token_expires_at)
        if datetime.now(timezone.utc) > expires_at:
            return jsonify(GENERIC_ERROR), 400
    except (TypeError, ValueError):
        return jsonify(GENERIC_ERROR), 400

    user.set_password(data["new_password"])
    user.reset_token_hash = None
    user.reset_token_expires_at = None
    db.session.commit()

    return jsonify({"message": "Senha redefinida com sucesso."}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """
    Retorna dados do usuário autenticado.
    user_id vem do token (identity), claims extras vêm do payload JWT.
    """
    user_id = get_jwt_identity()  # string: user_id
    claims = get_jwt()  # dict com tenant_id, role, etc.

    # SEGURANÇA: Busca sempre no banco — garante dados atualizados
    # (ex: se admin desativou o usuário após o token ser emitido)
    user = User.query.filter_by(
        id=user_id,
        is_deleted=False,
    ).first()

    if not user:
        return jsonify({"error": "user_not_found"}), 404

    if not user.is_active:
        return jsonify({"error": "user_inactive", "message": "Conta desativada."}), 403

    return (
        jsonify(
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role.value,
                "tenant_id": user.tenant_id,
                "email_verified": user.email_verified,
                "preferences": user.preferences,
                "study_availability": user.study_availability,
            }
        ),
        200,
    )


@auth_bp.route("/profile", methods=["PUT"])
@jwt_required()
@require_tenant
def update_profile():
    """Atualiza nome do usuário autenticado."""
    user_id = get_jwt_identity()
    user = User.query.filter_by(
        id=user_id, tenant_id=g.tenant.id, is_deleted=False
    ).first_or_404()

    data = request.get_json() or {}
    name = data.get("name", "").strip()

    if not name:
        return jsonify({"error": "bad_request", "message": "Nome obrigatório."}), 400
    if len(name) < 2:
        return jsonify({"error": "bad_request", "message": "Nome muito curto."}), 400

    user.name = name
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Perfil atualizado.",
                "user": {
                    "id": str(user.id),
                    "name": user.name,
                    "email": user.email,
                    "role": user.role,
                },
            }
        ),
        200,
    )
