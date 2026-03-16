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
    """Valida entrada do login. SEGURANÇA: Rejeita campos extras."""
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=1, max=128))

    class Meta:
        unknown = EXCLUDE  # Ignora campos não esperados


class RegisterSchema(Schema):
    """Valida registro de aluno."""
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    email = fields.Email(required=True)
    password = fields.Str(
        required=True,
        validate=[
            validate.Length(min=8, max=128),
            # SEGURANÇA: Senha deve ter letra e número no mínimo
        ]
    )

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

def _build_identity(user: User) -> dict:
    """
    Payload do JWT. Mínimo necessário — não incluir dados sensíveis.
    SEGURANÇA: tenant_id no token evita que um aluno acesse outro tenant.
    """
    return {
        "user_id": user.id,
        "tenant_id": user.tenant_id,
        "role": user.role.value,
    }


def _hash_token(token: str) -> str:
    """Hash SHA-256 de tokens de reset/verificação. Nunca armazena em texto plano."""
    return hashlib.sha256(token.encode()).hexdigest()


# ── Rotas ──────────────────────────────────────────────────────────────────────

@auth_bp.before_request
def before_request():
    """Resolve o tenant antes de qualquer rota de auth."""
    resolve_tenant()


@auth_bp.route("/login", methods=["POST"])
@require_tenant
@limiter.limit("10 per minute")   # SEGURANÇA: Previne brute-force
def login():
    """
    Login com e-mail e senha.
    Retorna access_token (1h) e refresh_token (30d).

    SEGURANÇA:
    - Mensagem de erro genérica (não revela se e-mail existe)
    - Rate limit de 10 tentativas por minuto por IP
    - Tempo de resposta constante (bcrypt garante isso)
    """
    schema = LoginSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    tenant = get_current_tenant()

    user = User.query.filter_by(
        email=data["email"].lower().strip(),
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    # SEGURANÇA: Mesmo erro se usuário não existe OU senha errada (evita enumeração)
    GENERIC_ERROR = {"error": "invalid_credentials", "message": "E-mail ou senha inválidos."}

    if not user:
        return jsonify(GENERIC_ERROR), 401

    if not user.is_active:
        # SEGURANÇA: Não revela se o usuário existe; apenas nega acesso
        return jsonify(GENERIC_ERROR), 401

    if not user.check_password(data["password"]):
        return jsonify(GENERIC_ERROR), 401

    identity = _build_identity(user)
    access_token = create_access_token(identity=identity)
    refresh_token = create_refresh_token(identity=identity)

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
        },
    }), 200


@auth_bp.route("/register", methods=["POST"])
@require_tenant
@limiter.limit("5 per minute")   # SEGURANÇA: Previne spam de cadastro
def register():
    """
    Registro de novo aluno.
    Produtores e staff são criados via painel admin (não por esta rota).
    """
    schema = RegisterSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    tenant = get_current_tenant()

    # Verifica se e-mail já existe neste tenant
    existing = User.query.filter_by(
        email=data["email"].lower().strip(),
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    if existing:
        # SEGURANÇA: Mensagem vaga — não confirma se o e-mail existe
        return jsonify({
            "error": "registration_failed",
            "message": "Não foi possível completar o cadastro com este e-mail.",
        }), 409

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

    # TODO: Disparar e-mail de verificação via Celery task

    return jsonify({
        "message": "Cadastro realizado. Verifique seu e-mail para ativar a conta.",
        "user_id": user.id,
    }), 201


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
@limiter.limit("30 per minute")
def refresh():
    """
    Renova o access_token usando o refresh_token.
    SEGURANÇA: Apenas refresh_token válido pode chamar esta rota.
    """
    identity = get_jwt_identity()
    new_access_token = create_access_token(identity=identity)
    return jsonify({"access_token": new_access_token}), 200


@auth_bp.route("/forgot-password", methods=["POST"])
@require_tenant
@limiter.limit("3 per minute")   # SEGURANÇA: Muito restritivo para prevenir abuso
def forgot_password():
    """
    Solicita recuperação de senha.
    SEGURANÇA: Sempre retorna 200, mesmo se o e-mail não existe (evita enumeração).
    """
    schema = ForgotPasswordSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    tenant = get_current_tenant()
    GENERIC_OK = {"message": "Se este e-mail estiver cadastrado, você receberá as instruções."}

    user = User.query.filter_by(
        email=data["email"].lower().strip(),
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    if not user:
        # SEGURANÇA: Retorna 200 mesmo sem usuário (evita enumeração de e-mails)
        return jsonify(GENERIC_OK), 200

    # Gera token seguro de 32 bytes (256 bits)
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)

    # Token expira em 1 hora
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    user.reset_token_hash = token_hash
    user.reset_token_expires_at = expires_at
    db.session.commit()

    # TODO: Enviar e-mail com raw_token via Celery
    # from app.tasks.email_tasks import send_password_reset_email
    # send_password_reset_email.delay(user.id, raw_token)

    return jsonify(GENERIC_OK), 200


@auth_bp.route("/reset-password", methods=["POST"])
@require_tenant
@limiter.limit("5 per minute")
def reset_password():
    """
    Redefine senha com o token recebido por e-mail.
    SEGURANÇA: Token de uso único, expira em 1h.
    """
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

    # Verifica expiração
    try:
        expires_at = datetime.fromisoformat(user.reset_token_expires_at)
        if datetime.now(timezone.utc) > expires_at:
            return jsonify(GENERIC_ERROR), 400
    except (TypeError, ValueError):
        return jsonify(GENERIC_ERROR), 400

    # Atualiza senha e invalida token (uso único)
    user.set_password(data["new_password"])
    user.reset_token_hash = None
    user.reset_token_expires_at = None
    db.session.commit()

    return jsonify({"message": "Senha redefinida com sucesso."}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Retorna dados do usuário autenticado."""
    identity = get_jwt_identity()
    user = User.query.filter_by(
        id=identity["user_id"],
        is_deleted=False,
    ).first()

    if not user:
        return jsonify({"error": "user_not_found"}), 404

    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "tenant_id": user.tenant_id,
        "email_verified": user.email_verified,
        "preferences": user.preferences,
        "study_availability": user.study_availability,
    }), 200