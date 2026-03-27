# api/app/routes/tenants.py
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE
from sqlalchemy.orm.attributes import flag_modified

from app.extensions import db, limiter
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.middleware.tenant import resolve_tenant, require_tenant

tenants_bp = Blueprint("tenants", __name__)

ALL_FEATURES = [
    "ai_features",
    "ai_question_extract",
    "ai_schedule",
    "ai_tutor_chat",
    "analytics_producer",
    "simulados",
]


def _require_super_admin():
    claims = get_jwt()
    if claims.get("role") != UserRole.SUPER_ADMIN.value:
        return jsonify({"error": "forbidden", "message": "Acesso restrito."}), 403
    return None


# ── Schemas ───────────────────────────────────────────────────────────────────


class CreateTenantSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    slug = fields.Str(
        required=True,
        validate=[
            validate.Length(min=2, max=100),
            validate.Regexp(
                r"^[a-z0-9\-]+$", error="Apenas letras minúsculas, números e hífens."
            ),
        ],
    )
    plan = fields.Str(
        validate=validate.OneOf(["basic", "pro", "enterprise"]), load_default="pro"
    )
    custom_domain = fields.Str(allow_none=True, load_default=None)
    admin_name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    admin_email = fields.Email(required=True)
    admin_password = fields.Str(required=True, validate=validate.Length(min=8, max=128))

    class Meta:
        unknown = EXCLUDE


class UpdateTenantSchema(Schema):
    name = fields.Str(validate=validate.Length(min=2, max=255))
    plan = fields.Str(validate=validate.OneOf(["basic", "pro", "enterprise"]))
    is_active = fields.Bool()
    custom_domain = fields.Str(allow_none=True)
    features = fields.Dict(keys=fields.Str(), values=fields.Bool())

    class Meta:
        unknown = EXCLUDE


class UpdateAdminSchema(Schema):
    name = fields.Str(validate=validate.Length(min=2, max=255))
    email = fields.Email()
    password = fields.Str(
        validate=validate.Length(min=8, max=128), allow_none=True, load_default=None
    )

    class Meta:
        unknown = EXCLUDE


@tenants_bp.before_request
def before_request():
    resolve_tenant()


# ── Serializer ────────────────────────────────────────────────────────────────


def _serialize_tenant(t: Tenant, include_admin: bool = False) -> dict:
    data = {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "plan": t.plan,
        "is_active": t.is_active,
        "custom_domain": t.custom_domain,
        "features": t.features or {},
        "branding": t.branding or {},
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }
    if include_admin:
        admin = (
            User.query.filter_by(
                tenant_id=t.id,
                role=UserRole.PRODUCER_ADMIN.value,
                is_deleted=False,
            )
            .order_by(User.created_at.asc())
            .first()
        )
        data["admin"] = {
            "id": admin.id if admin else None,
            "name": admin.name if admin else None,
            "email": admin.email if admin else None,
        }
    return data


# ══════════════════════════════════════════════════════════════════════════════
# CRUD TENANTS
# ══════════════════════════════════════════════════════════════════════════════


@tenants_bp.route("/", methods=["GET"])
@jwt_required()
def list_tenants():
    err = _require_super_admin()
    if err:
        return err

    tenants = (
        Tenant.query.filter_by(is_deleted=False)
        .order_by(Tenant.created_at.desc())
        .all()
    )
    return (
        jsonify(
            {"tenants": [_serialize_tenant(t, include_admin=True) for t in tenants]}
        ),
        200,
    )


@tenants_bp.route("/", methods=["POST"])
@jwt_required()
@limiter.limit("20 per hour")
def create_tenant():
    err = _require_super_admin()
    if err:
        return err

    schema = CreateTenantSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    if Tenant.query.filter_by(slug=data["slug"], is_deleted=False).first():
        return (
            jsonify({"error": "slug_taken", "message": "Este slug já está em uso."}),
            409,
        )

    tenant = Tenant(
        name=data["name"],
        slug=data["slug"],
        plan=data["plan"],
        custom_domain=data.get("custom_domain"),
        features={f: True for f in ALL_FEATURES},  # ativa tudo por padrão
    )
    db.session.add(tenant)
    db.session.flush()

    admin = User(
        tenant_id=tenant.id,
        name=data["admin_name"],
        email=data["admin_email"].lower().strip(),
        role=UserRole.PRODUCER_ADMIN,
        email_verified=True,
    )
    admin.set_password(data["admin_password"])
    db.session.add(admin)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Tenant criado.",
                "tenant": _serialize_tenant(tenant, include_admin=True),
            }
        ),
        201,
    )


@tenants_bp.route("/<string:tenant_id>", methods=["GET"])
@jwt_required()
def get_tenant(tenant_id: str):
    err = _require_super_admin()
    if err:
        return err

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"error": "not_found"}), 404

    return jsonify({"tenant": _serialize_tenant(tenant, include_admin=True)}), 200


@tenants_bp.route("/<string:tenant_id>", methods=["PUT"])
@jwt_required()
def update_tenant(tenant_id: str):
    """Atualiza dados do tenant: nome, plano, status, domínio e features."""
    err = _require_super_admin()
    if err:
        return err

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"error": "not_found"}), 404

    schema = UpdateTenantSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    if "name" in data:
        tenant.name = data["name"].strip()
    if "plan" in data:
        tenant.plan = data["plan"]
    if "is_active" in data:
        tenant.is_active = data["is_active"]
    if "custom_domain" in data:
        tenant.custom_domain = data["custom_domain"] or None

    if "features" in data:
        current = dict(tenant.features or {})
        current.update(data["features"])
        tenant.features = current
        flag_modified(tenant, "features")

    db.session.commit()
    return (
        jsonify(
            {
                "message": "Tenant atualizado.",
                "tenant": _serialize_tenant(tenant, include_admin=True),
            }
        ),
        200,
    )


@tenants_bp.route("/<string:tenant_id>", methods=["DELETE"])
@jwt_required()
def delete_tenant(tenant_id: str):
    """Soft delete do tenant."""
    err = _require_super_admin()
    if err:
        return err

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"error": "not_found"}), 404

    # Não permite deletar o próprio tenant do super admin
    claims = get_jwt()
    if claims.get("tenant_id") == tenant_id:
        return (
            jsonify(
                {
                    "error": "forbidden",
                    "message": "Não é possível deletar o tenant da plataforma.",
                }
            ),
            403,
        )

    tenant.soft_delete()
    db.session.commit()
    return jsonify({"message": f"Tenant '{tenant.name}' removido."}), 200


@tenants_bp.route("/<string:tenant_id>/admin", methods=["PUT"])
@jwt_required()
def update_tenant_admin(tenant_id: str):
    """Atualiza dados do admin (produtor) de um tenant: nome, email, senha."""
    err = _require_super_admin()
    if err:
        return err

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"error": "not_found"}), 404

    schema = UpdateAdminSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    admin = (
        User.query.filter_by(
            tenant_id=tenant_id,
            role=UserRole.PRODUCER_ADMIN.value,
            is_deleted=False,
        )
        .order_by(User.created_at.asc())
        .first()
    )

    if not admin:
        return (
            jsonify(
                {"error": "not_found", "message": "Admin do tenant não encontrado."}
            ),
            404,
        )

    if "name" in data and data["name"]:
        admin.name = data["name"].strip()
    if "email" in data and data["email"]:
        # Verifica se email já está em uso no tenant
        existing = User.query.filter_by(
            tenant_id=tenant_id,
            email=data["email"].lower(),
            is_deleted=False,
        ).first()
        if existing and existing.id != admin.id:
            return (
                jsonify({"error": "email_taken", "message": "E-mail já em uso."}),
                409,
            )
        admin.email = data["email"].lower().strip()
    if data.get("password"):
        admin.set_password(data["password"])

    db.session.commit()
    return (
        jsonify(
            {
                "message": "Admin atualizado.",
                "admin": {"id": admin.id, "name": admin.name, "email": admin.email},
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# FEATURES (atalho direto)
# ══════════════════════════════════════════════════════════════════════════════


@tenants_bp.route("/<string:tenant_id>/features", methods=["PUT"])
@jwt_required()
def update_features(tenant_id: str):
    """Ativa/desativa features de um tenant individualmente."""
    err = _require_super_admin()
    if err:
        return err

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"error": "not_found"}), 404

    data = request.get_json(force=True) or {}
    current = dict(tenant.features or {})
    for key, value in data.items():
        if isinstance(value, bool):
            current[key] = value
    tenant.features = current
    flag_modified(tenant, "features")
    db.session.commit()

    return (
        jsonify({"message": "Features atualizadas.", "features": tenant.features}),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# ROTAS EXISTENTES (mantidas)
# ══════════════════════════════════════════════════════════════════════════════


@tenants_bp.route("/<tenant_id>/branding", methods=["PUT"])
@jwt_required()
@require_tenant
def update_branding(tenant_id):
    claims = get_jwt()
    role = claims.get("role")
    jwt_tenant_id = claims.get("tenant_id")

    if role not in ("producer_admin", "super_admin"):
        return jsonify({"error": "forbidden"}), 403
    if role == "producer_admin" and jwt_tenant_id != tenant_id:
        return jsonify({"error": "forbidden"}), 403

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first_or_404()
    data = request.get_json() or {}

    # Lê o branding atual completo (preserva campos de aparência já salvos)
    current_branding = dict(tenant.branding or {})

    # Campos básicos de identidade visual (editados pela página de Branding)
    basic_fields = [
        "primary_color",
        "secondary_color",
        "platform_name",
        "support_email",
        "logo_url",
        "favicon_url",
    ]
    # Campos de aparência avançada (editados pela página de Aparência)
    # São preservados aqui mesmo que não venham no payload
    appearance_fields = [
        "color_palette",
        "custom_vars",
        "layout_student",
        "layout_producer",
        "login_layout",
        "login_bg_url",
        "login_bg_color",
    ]

    allowed = basic_fields + appearance_fields

    for field in allowed:
        if field in data:
            current_branding[field] = data[field]

    tenant.branding = current_branding
    flag_modified(tenant, "branding")
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Branding atualizado.",
                "branding": tenant.branding,
                "tenant_id": tenant.id,
            }
        ),
        200,
    )


@tenants_bp.route("/by-slug/<string:slug>", methods=["GET"])
def get_tenant_by_slug(slug: str):
    tenant = Tenant.query.filter_by(
        slug=slug.strip().lower()[:100], is_deleted=False, is_active=True
    ).first()
    if not tenant:
        return jsonify({"error": "not_found"}), 404
    return (
        jsonify(
            {
                "tenant": {
                    "id": tenant.id,
                    "name": tenant.name,
                    "slug": tenant.slug,
                    "plan": tenant.plan,
                    "features": tenant.features or {},
                    "branding": tenant.branding or {},
                    "custom_domain": tenant.custom_domain,
                }
            }
        ),
        200,
    )


@tenants_bp.route("/notify", methods=["POST"])
@jwt_required()
@require_tenant
def notify_students():
    claims = get_jwt()
    if claims.get("role") not in ("producer_admin", "producer_staff", "super_admin"):
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json() or {}
    title = data.get("title", "").strip()
    message = data.get("message", "").strip()
    if not title or not message:
        return (
            jsonify(
                {"error": "bad_request", "message": "title e message são obrigatórios."}
            ),
            400,
        )

    tenant = g.tenant
    students = User.query.filter_by(
        tenant_id=tenant.id, role="student", is_deleted=False
    ).all()
    from app.tasks import send_broadcast_email

    for student in students:
        send_broadcast_email.delay(
            to_email=student.email,
            to_name=student.name,
            subject=title,
            body=message,
            tenant_name=tenant.name,
        )
    return (
        jsonify(
            {
                "message": f"Notificação enviada para {len(students)} aluno(s).",
                "recipients": len(students),
            }
        ),
        200,
    )
