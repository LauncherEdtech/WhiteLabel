# api/app/routes/tenants.py
# Gerenciamento de tenants (infoprodutores).
# SEGURANÇA: Apenas super_admin pode criar/editar tenants.

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity
# FIX: Importar EXCLUDE diretamente do marshmallow (é um sentinel, não string)
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE

from app.extensions import db, limiter
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.middleware.tenant import resolve_tenant

tenants_bp = Blueprint("tenants", __name__)


def _require_super_admin():
    """Verifica se o usuário autenticado é super_admin."""
    identity = get_jwt_identity()
    if identity.get("role") != UserRole.SUPER_ADMIN.value:
        return jsonify({"error": "forbidden", "message": "Acesso restrito."}), 403
    return None


class CreateTenantSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    slug = fields.Str(required=True, validate=[
        validate.Length(min=2, max=100),
        validate.Regexp(
            r"^[a-z0-9\-]+$",
            error="Slug deve conter apenas letras minúsculas, números e hífens."
        )
    ])
    plan = fields.Str(
        validate=validate.OneOf(["basic", "pro", "enterprise"]),
        load_default="basic"
    )
    custom_domain = fields.Str(
        validate=validate.Length(max=255),
        allow_none=True,
        load_default=None
    )
    admin_name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    admin_email = fields.Email(required=True)
    admin_password = fields.Str(required=True, validate=validate.Length(min=8, max=128))

    class Meta:
        unknown = EXCLUDE   # FIX: usa o sentinel importado, não string


@tenants_bp.before_request
def before_request():
    resolve_tenant()


@tenants_bp.route("/", methods=["POST"])
@jwt_required()
@limiter.limit("20 per hour")
def create_tenant():
    """
    Cria um novo tenant (infoprodutor) na plataforma.
    SEGURANÇA: Exclusivo para super_admin.
    """
    error = _require_super_admin()
    if error:
        return error

    schema = CreateTenantSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    # Verifica unicidade do slug
    if Tenant.query.filter_by(slug=data["slug"], is_deleted=False).first():
        return jsonify({"error": "slug_taken", "message": "Este slug já está em uso."}), 409

    # Cria o tenant
    tenant = Tenant(
        name=data["name"],
        slug=data["slug"],
        plan=data["plan"],
        custom_domain=data.get("custom_domain"),
    )
    db.session.add(tenant)
    db.session.flush()  # Obtém o ID antes do commit para criar o admin

    # Cria o usuário admin do tenant
    admin = User(
        tenant_id=tenant.id,
        name=data["admin_name"],
        email=data["admin_email"].lower().strip(),
        role=UserRole.PRODUCER_ADMIN,
        email_verified=True,  # Admin criado pelo super_admin já é verificado
    )
    admin.set_password(data["admin_password"])
    db.session.add(admin)
    db.session.commit()

    return jsonify({
        "message": "Tenant criado com sucesso.",
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "plan": tenant.plan,
        },
        "admin": {
            "id": admin.id,
            "email": admin.email,
        },
    }), 201


@tenants_bp.route("/", methods=["GET"])
@jwt_required()
def list_tenants():
    """Lista todos os tenants. Apenas super_admin."""
    error = _require_super_admin()
    if error:
        return error

    tenants = Tenant.query.filter_by(is_deleted=False).order_by(Tenant.created_at.desc()).all()
    return jsonify({
        "tenants": [
            {
                "id": t.id,
                "name": t.name,
                "slug": t.slug,
                "plan": t.plan,
                "is_active": t.is_active,
                "custom_domain": t.custom_domain,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tenants
        ]
    }), 200