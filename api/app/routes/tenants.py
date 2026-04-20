# api/app/routes/tenants.py
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from flask import Blueprint, request, jsonify, g, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE
from sqlalchemy import func, distinct, case
from sqlalchemy.orm.attributes import flag_modified

from app.extensions import db, limiter
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.middleware.tenant import get_current_tenant, resolve_tenant, require_tenant

tenants_bp = Blueprint("tenants", __name__)

ALL_FEATURES = [
    "ai_features", "ai_question_extract", "ai_schedule", "ai_tutor_chat",
    "analytics_producer", "simulados", "video_hosting",
]


def _require_super_admin():
    claims = get_jwt()
    if claims.get("role") != UserRole.SUPER_ADMIN.value:
        return jsonify({"error": "forbidden", "message": "Acesso restrito."}), 403
    return None


class CreateTenantSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    slug = fields.Str(required=True, validate=[validate.Length(min=2, max=100), validate.Regexp(r"^[a-z0-9\-]+$", error="Apenas letras minúsculas, números e hífens.")])
    plan = fields.Str(validate=validate.OneOf(["basic", "pro", "enterprise"]), load_default="pro")
    custom_domain = fields.Str(allow_none=True, load_default=None)
    admin_name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    admin_email = fields.Email(required=True)
    admin_password = fields.Str(required=True, validate=validate.Length(min=8, max=128))
    class Meta:
        unknown = EXCLUDE


class UpdateTenantSchema(Schema):
    name = fields.Str(validate=validate.Length(min=2, max=255))
    # slug agora é editável — mesmo padrão do CreateTenantSchema
    slug = fields.Str(validate=[
        validate.Length(min=2, max=100),
        validate.Regexp(r"^[a-z0-9\-]+$", error="Apenas letras minúsculas, números e hífens.")
    ])
    plan = fields.Str(validate=validate.OneOf(["basic", "pro", "enterprise"]))
    is_active = fields.Bool()
    custom_domain = fields.Str(allow_none=True)
    features = fields.Dict(keys=fields.Str(), values=fields.Bool())
    class Meta:
        unknown = EXCLUDE


class UpdateAdminSchema(Schema):
    name = fields.Str(validate=validate.Length(min=2, max=255))
    email = fields.Email()
    password = fields.Str(validate=validate.Length(min=8, max=128), allow_none=True, load_default=None)
    class Meta:
        unknown = EXCLUDE


@tenants_bp.before_request
def before_request():
    resolve_tenant()


def _serialize_tenant(t: Tenant, include_admin: bool = False) -> dict:
    data = {"id": t.id, "name": t.name, "slug": t.slug, "plan": t.plan, "is_active": t.is_active,
            "custom_domain": t.custom_domain, "features": t.features or {}, "branding": t.branding or {},
            "created_at": t.created_at.isoformat() if t.created_at else None}
    if include_admin:
        admin = User.query.filter_by(tenant_id=t.id, role=UserRole.PRODUCER_ADMIN.value, is_deleted=False).order_by(User.created_at.asc()).first()
        data["admin"] = {"id": admin.id if admin else None, "name": admin.name if admin else None, "email": admin.email if admin else None}
    return data


def _invalidate_tenant_dashboard_cache(tenant):
    """Remove cache de dashboard de todos os alunos do tenant."""
    try:
        from app.extensions import redis_client
        students = User.query.filter_by(tenant_id=tenant.id, role=UserRole.STUDENT.value, is_deleted=False).with_entities(User.id).all()
        keys = [f"analytics:dashboard:{tenant.id}:{s.id}" for s in students]
        if keys:
            redis_client.delete(*keys)
    except Exception:
        pass


def _invalidate_tenant_all_cache(tenant):
    """
    Remove TODOS os caches associados ao tenant após um rename de slug.
    Usa SCAN para encontrar keys com padrão tenant_id — seguro para produção.
    """
    try:
        from app.extensions import redis_client
        # Chaves que usam tenant_id (UUID) — não dependem do slug, mas limpamos por segurança
        patterns = [
            f"analytics:*:{tenant.id}:*",
            f"insights:{tenant.id}:*",
            f"capsule:{tenant.id}:*",
            f"rate_limit:*:{tenant.id}:*",
        ]
        for pattern in patterns:
            cursor = 0
            while True:
                cursor, keys = redis_client.scan(cursor, match=pattern, count=100)
                if keys:
                    redis_client.delete(*keys)
                if cursor == 0:
                    break
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════════════════════
# CRUD TENANTS
# ══════════════════════════════════════════════════════════════════════════════

@tenants_bp.route("/", methods=["GET"])
@jwt_required()
def list_tenants():
    err = _require_super_admin()
    if err: return err
    tenants = Tenant.query.filter_by(is_deleted=False).order_by(Tenant.created_at.desc()).all()
    return jsonify({"tenants": [_serialize_tenant(t, include_admin=True) for t in tenants]}), 200


@tenants_bp.route("/", methods=["POST"])
@jwt_required()
@limiter.limit("20 per hour")
def create_tenant():
    err = _require_super_admin()
    if err: return err
    schema = CreateTenantSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400
    if Tenant.query.filter_by(slug=data["slug"], is_deleted=False).first():
        return jsonify({"error": "slug_taken", "message": "Este slug já está em uso."}), 409
    tenant = Tenant(name=data["name"], slug=data["slug"], plan=data["plan"], custom_domain=data.get("custom_domain"),
                    features={**{f: True for f in ALL_FEATURES if f != "video_hosting"}, "video_hosting": False})
    db.session.add(tenant)
    db.session.flush()
    admin = User(tenant_id=tenant.id, name=data["admin_name"], email=data["admin_email"].lower().strip(),
                 role=UserRole.PRODUCER_ADMIN, email_verified=True)
    admin.set_password(data["admin_password"])
    db.session.add(admin)
    db.session.commit()
    return jsonify({"message": "Tenant criado.", "tenant": _serialize_tenant(tenant, include_admin=True)}), 201


@tenants_bp.route("/<string:tenant_id>", methods=["GET"])
@jwt_required()
def get_tenant(tenant_id: str):
    err = _require_super_admin()
    if err: return err
    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant: return jsonify({"error": "not_found"}), 404
    return jsonify({"tenant": _serialize_tenant(tenant, include_admin=True)}), 200


@tenants_bp.route("/<string:tenant_id>", methods=["PUT"])
@jwt_required()
def update_tenant(tenant_id: str):
    err = _require_super_admin()
    if err: return err
    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant: return jsonify({"error": "not_found"}), 404
    schema = UpdateTenantSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    slug_changed = False

    # ── Slug rename ────────────────────────────────────────────────────────────
    if "slug" in data:
        new_slug = data["slug"].strip().lower()
        if new_slug != tenant.slug:
            # Verifica unicidade — exclui o próprio tenant da comparação
            conflict = Tenant.query.filter(
                Tenant.slug == new_slug,
                Tenant.is_deleted == False,
                Tenant.id != tenant_id,
            ).first()
            if conflict:
                return jsonify({"error": "slug_taken", "message": "Este slug já está em uso por outro tenant."}), 409

            # Impede rename do tenant da plataforma (platform) — quebraria o admin
            claims = get_jwt()
            if tenant.slug == "platform":
                return jsonify({"error": "forbidden", "message": "O slug do tenant da plataforma não pode ser alterado."}), 403

            tenant.slug = new_slug
            slug_changed = True

    if "name" in data: tenant.name = data["name"].strip()
    if "plan" in data: tenant.plan = data["plan"]
    if "is_active" in data: tenant.is_active = data["is_active"]
    if "custom_domain" in data: tenant.custom_domain = data["custom_domain"] or None
    if "features" in data:
        current = dict(tenant.features or {})
        current.update(data["features"])
        tenant.features = current
        flag_modified(tenant, "features")

    db.session.commit()

    # Pós-commit: invalida caches se o slug mudou
    if slug_changed:
        _invalidate_tenant_all_cache(tenant)

    response_data = {
        "message": "Tenant atualizado.",
        "tenant": _serialize_tenant(tenant, include_admin=True),
        "slug_changed": slug_changed,
    }
    return jsonify(response_data), 200


@tenants_bp.route("/<string:tenant_id>", methods=["DELETE"])
@jwt_required()
def delete_tenant(tenant_id: str):
    err = _require_super_admin()
    if err: return err
    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant: return jsonify({"error": "not_found"}), 404
    claims = get_jwt()
    if claims.get("tenant_id") == tenant_id:
        return jsonify({"error": "forbidden", "message": "Não é possível deletar o tenant da plataforma."}), 403
    tenant.soft_delete()
    db.session.commit()
    return jsonify({"message": f"Tenant '{tenant.name}' removido."}), 200


@tenants_bp.route("/<string:tenant_id>/admin", methods=["PUT"])
@jwt_required()
def update_tenant_admin(tenant_id: str):
    err = _require_super_admin()
    if err: return err
    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant: return jsonify({"error": "not_found"}), 404
    schema = UpdateAdminSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400
    admin = User.query.filter_by(tenant_id=tenant_id, role=UserRole.PRODUCER_ADMIN.value, is_deleted=False).order_by(User.created_at.asc()).first()
    if not admin: return jsonify({"error": "not_found", "message": "Admin do tenant não encontrado."}), 404
    if "name" in data and data["name"]: admin.name = data["name"].strip()
    if "email" in data and data["email"]:
        existing = User.query.filter_by(tenant_id=tenant_id, email=data["email"].lower(), is_deleted=False).first()
        if existing and existing.id != admin.id:
            return jsonify({"error": "email_taken", "message": "E-mail já em uso."}), 409
        admin.email = data["email"].lower().strip()
    if data.get("password"): admin.set_password(data["password"])
    db.session.commit()
    return jsonify({"message": "Admin atualizado.", "admin": {"id": admin.id, "name": admin.name, "email": admin.email}}), 200


# ══════════════════════════════════════════════════════════════════════════════
# FEATURES
# ══════════════════════════════════════════════════════════════════════════════

@tenants_bp.route("/<string:tenant_id>/features", methods=["PUT"])
@jwt_required()
def update_features(tenant_id: str):
    err = _require_super_admin()
    if err: return err
    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant: return jsonify({"error": "not_found"}), 404
    data = request.get_json(force=True) or {}
    current = dict(tenant.features or {})
    for key, value in data.items():
        if isinstance(value, bool): current[key] = value
    tenant.features = current
    flag_modified(tenant, "features")
    db.session.commit()
    return jsonify({"message": "Features atualizadas.", "features": tenant.features}), 200


@tenants_bp.route("/my-features", methods=["GET"])
@jwt_required()
@require_tenant
def get_my_features():
    claims = get_jwt()
    if claims.get("role") not in (UserRole.SUPER_ADMIN.value, UserRole.PRODUCER_ADMIN.value, UserRole.PRODUCER_STAFF.value):
        return jsonify({"error": "forbidden"}), 403
    tenant = get_current_tenant()
    return jsonify({"features": tenant.features or {}}), 200


# ══════════════════════════════════════════════════════════════════════════════
# BRANDING / SLUG / NOTIFY
# ══════════════════════════════════════════════════════════════════════════════

@tenants_bp.route("/<tenant_id>/branding", methods=["PUT"])
@jwt_required()
@require_tenant
def update_branding(tenant_id):
    claims = get_jwt()
    role = claims.get("role")
    jwt_tenant_id = claims.get("tenant_id")
    if role not in ("producer_admin", "super_admin"): return jsonify({"error": "forbidden"}), 403
    if role == "producer_admin" and jwt_tenant_id != tenant_id: return jsonify({"error": "forbidden"}), 403
    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first_or_404()
    data = request.get_json() or {}
    current_branding = dict(tenant.branding or {})
    allowed = ["primary_color","secondary_color","platform_name","support_email","logo_url","favicon_url",
               "color_palette","custom_vars","layout_student","layout_producer","login_layout","login_bg_url","login_bg_color","instagram_handle"]
    for field in allowed:
        if field in data: current_branding[field] = data[field]
    tenant.branding = current_branding
    flag_modified(tenant, "branding")
    db.session.commit()
    return jsonify({"message": "Branding atualizado.", "branding": tenant.branding, "tenant_id": tenant.id}), 200


@tenants_bp.route("/by-slug/<string:slug>", methods=["GET"])
def get_tenant_by_slug(slug: str):
    tenant = Tenant.query.filter_by(slug=slug.strip().lower()[:100], is_deleted=False, is_active=True).first()
    if not tenant: return jsonify({"error": "not_found"}), 404
    return jsonify({"tenant": {
        "id": tenant.id, "name": tenant.name, "slug": tenant.slug, "plan": tenant.plan,
        "features": tenant.features or {}, "branding": tenant.branding or {},
        "settings": tenant.settings or {},  # necessário para carregar temas no frontend
        "custom_domain": tenant.custom_domain,
    }}), 200


@tenants_bp.route("/<tenant_id>/notify", methods=["POST"])
@jwt_required()
@require_tenant
def notify_students(tenant_id):
    """
    Envia uma notificação in-platform para todos os alunos ativos do tenant.
    Cria um registro Notification por aluno (leitura individual rastreável).
 
    SEGURANÇA:
    - producer_admin só pode notificar seu próprio tenant (check jwt_tenant_id)
    - producer_staff herda a restrição do tenant via g.tenant (X-Tenant-Slug)
    - Usa g.tenant para queries — não confia em tenant_id da URL
    - Valida tamanho de título e mensagem para evitar payloads absurdos
    """
    from app.models.notification import Notification
 
    claims = get_jwt()
    role = claims.get("role")
    jwt_tenant_id = claims.get("tenant_id")
 
    # Verifica papel — apenas produtor ou super_admin pode enviar notificações
    if role not in ("producer_admin", "producer_staff", "super_admin"):
        return jsonify({"error": "forbidden"}), 403
 
    # SEGURANÇA: producer_admin não pode enviar para um tenant diferente do seu
    if role == "producer_admin" and jwt_tenant_id != tenant_id:
        return jsonify({"error": "forbidden"}), 403
 
    data = request.get_json() or {}
    title = data.get("title", "").strip()
    message = data.get("message", "").strip()
 
    if not title or not message:
        return jsonify({"error": "bad_request", "message": "title e message são obrigatórios."}), 400
 
    if len(title) > 255:
        return jsonify({"error": "bad_request", "message": "Título deve ter no máximo 255 caracteres."}), 400
 
    if len(message) > 2000:
        return jsonify({"error": "bad_request", "message": "Mensagem deve ter no máximo 2000 caracteres."}), 400
 
    tenant = g.tenant
    sender_id = get_jwt_identity()
 
    students = User.query.filter_by(
        tenant_id=tenant.id, role="student", is_active=True, is_deleted=False,
    ).all()
 
    if not students:
        return jsonify({"message": "Nenhum aluno ativo encontrado.", "recipients": 0}), 200
 
    notifications = [
        Notification(
            tenant_id=tenant.id, title=title, message=message,
            notification_type="broadcast", sender_id=sender_id, recipient_id=student.id,
        )
        for student in students
    ]
 
    db.session.bulk_save_objects(notifications)
    db.session.commit()
 
    return jsonify({"message": f"Notificação enviada para {len(students)} aluno(s).", "recipients": len(students)}), 200


# ══════════════════════════════════════════════════════════════════════════════
# SETTINGS DO TENANT
# ══════════════════════════════════════════════════════════════════════════════

@tenants_bp.route("/<tenant_id>/settings", methods=["PUT"])
@jwt_required()
@require_tenant
def update_settings(tenant_id):
    """Salva configurações operacionais do tenant — insight_theme, gamification_theme, etc."""
    claims = get_jwt()
    role = claims.get("role")
    jwt_tenant_id = claims.get("tenant_id")
    if role not in ("producer_admin", "super_admin"): return jsonify({"error": "forbidden"}), 403
    if role == "producer_admin" and jwt_tenant_id != tenant_id: return jsonify({"error": "forbidden"}), 403

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first_or_404()
    data = request.get_json() or {}

    VALID_THEMES = ["militar", "policial", "juridico", "fiscal", "administrativo", "saude"]
    ALLOWED_SETTINGS = {
        "insight_theme": VALID_THEMES,
        "gamification_theme": VALID_THEMES,
        "timezone": None,
        "default_language": None,
    }

    current_settings = dict(tenant.settings or {})
    for key, valid_values in ALLOWED_SETTINGS.items():
        if key not in data: continue
        value = data[key]
        if valid_values is not None and value not in valid_values:
            return jsonify({"error": "invalid_value", "field": key, "valid": valid_values}), 400
        current_settings[key] = value

    tenant.settings = current_settings
    flag_modified(tenant, "settings")
    db.session.commit()
    return jsonify({"message": "Configurações atualizadas.", "settings": tenant.settings}), 200


# ══════════════════════════════════════════════════════════════════════════════
# TRACKING DE DADOS DO TENANT (super_admin only)
# Métricas de engajamento e performance dos alunos de um tenant.
# Computed on-demand — sem cache, dados sempre frescos.
# ══════════════════════════════════════════════════════════════════════════════

@tenants_bp.route("/<string:tenant_id>/tracking", methods=["GET"])
@jwt_required()
def get_tenant_tracking(tenant_id: str):
    """
    MACRO: métricas agregadas do tenant.
    D1/D7 baseados no primeiro evento real (não created_at).
    DAU/MAU calculados em BRT (UTC-3).
    """
    err = _require_super_admin()
    if err: return err

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"error": "not_found"}), 404

    from app.models.question import QuestionAttempt
    from app.models.schedule import ScheduleCheckIn
    from app.models.course import LessonProgress

    BRT = timezone(timedelta(hours=-3))
    now = datetime.now(BRT)
    today_date = now.date()
    cutoff_30 = (now - timedelta(days=30)).date()
    warnings: list[str] = []

    students = (
        User.query
        .filter_by(tenant_id=tenant_id, role=UserRole.STUDENT.value, is_deleted=False)
        .with_entities(User.id)
        .all()
    )
    total_students = len(students)
    student_ids: set[str] = {str(s.id) for s in students}

    # Mapa user_id → set de dates com atividade (3 queries, sem IN clause)
    activity_by_user: dict[str, set] = defaultdict(set)
    for model, date_col in [
        (QuestionAttempt, QuestionAttempt.created_at),
        (ScheduleCheckIn, ScheduleCheckIn.created_at),
        (LessonProgress,  LessonProgress.updated_at),
    ]:
        rows = (
            db.session.query(model.user_id, func.date(date_col))
            .filter(model.tenant_id == tenant_id)
            .distinct().all()
        )
        for uid, day in rows:
            uid_str = str(uid)
            if uid_str in student_ids:
                activity_by_user[uid_str].add(day)

    dau = sum(1 for days in activity_by_user.values() if today_date in days)
    mau = sum(1 for days in activity_by_user.values() if any(d >= cutoff_30 for d in days))
    stickiness = round(dau / mau * 100, 1) if mau > 0 else 0.0
    activated = sum(1 for days in activity_by_user.values() if days)
    taxa_ativacao = round(activated / total_students * 100, 1) if total_students > 0 else 0.0

    d1_eligible_count = 0; d1_returned = 0
    d7_eligible_count = 0; d7_returned = 0
    for uid, days in activity_by_user.items():
        if not days: continue
        first_day = min(days)
        days_since = (today_date - first_day).days
        if days_since >= 1:
            d1_eligible_count += 1
            if (first_day + timedelta(days=1)) in days: d1_returned += 1
        if days_since >= 7:
            d7_eligible_count += 1
            if {first_day + timedelta(days=i) for i in range(1, 8)} & days: d7_returned += 1

    retorno_d1 = round(d1_returned / d1_eligible_count * 100, 1) if d1_eligible_count > 0 else 0.0
    retorno_d7 = round(d7_returned / d7_eligible_count * 100, 1) if d7_eligible_count > 0 else 0.0

    if 0 < d1_eligible_count < 5:
        warnings.append(f"Retorno D1 calculado com apenas {d1_eligible_count} aluno(s) — base amostral pequena.")
    if 0 < d7_eligible_count < 5:
        warnings.append(f"Retorno D7 calculado com apenas {d7_eligible_count} aluno(s) — base amostral pequena.")

    qa_total = db.session.query(func.count(QuestionAttempt.id)).filter(QuestionAttempt.tenant_id == tenant_id).scalar() or 0
    ci_total = db.session.query(func.count(ScheduleCheckIn.id)).filter(ScheduleCheckIn.tenant_id == tenant_id).scalar() or 0
    lp_total = db.session.query(func.count(LessonProgress.id)).filter(
        LessonProgress.tenant_id == tenant_id, LessonProgress.status.in_(["watched", "partial"])
    ).scalar() or 0
    total_events = qa_total + ci_total + lp_total

    def _pct(val): return round(val / total_events * 100, 1) if total_events > 0 else 0.0

    uso_funcionalidades = {
        "questoes":   {"label": "Questões",   "count": qa_total, "pct": _pct(qa_total)},
        "cronograma": {"label": "Cronograma", "count": ci_total, "pct": _pct(ci_total)},
        "aulas":      {"label": "Aulas",      "count": lp_total, "pct": _pct(lp_total)},
    }

    performance_semanal = []
    for week_i in range(3, -1, -1):
        week_end   = now - timedelta(days=7 * week_i)
        week_start = week_end - timedelta(days=7)
        row = db.session.query(
            func.count(QuestionAttempt.id).label("total"),
            func.sum(case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
        ).filter(
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.created_at >= week_start,
            QuestionAttempt.created_at < week_end,
        ).first()
        total_q = row.total or 0
        correct_q = int(row.correct or 0)
        performance_semanal.append({
            "label":           "Semana atual" if week_i == 0 else f"Semana -{week_i}",
            "week_start":      week_start.date().isoformat(),
            "week_end":        week_end.date().isoformat(),
            "total_questions": total_q,
            "correct":         correct_q,
            "accuracy_pct":    round(correct_q / total_q * 100, 1) if total_q > 0 else 0.0,
        })

    return jsonify({
        "tenant_id": tenant_id, "tenant_name": tenant.name,
        "computed_at": now.isoformat(), "total_students": total_students,
        "dau": dau, "mau": mau, "stickiness": stickiness,
        "taxa_ativacao": taxa_ativacao, "retorno_d1": retorno_d1, "retorno_d7": retorno_d7,
        "d1_eligible": d1_eligible_count, "d7_eligible": d7_eligible_count,
        "uso_funcionalidades": uso_funcionalidades, "total_events": total_events,
        "performance_semanal": performance_semanal, "warnings": warnings,
    }), 200


# ══════════════════════════════════════════════════════════════════════════════
# TRACKING MICRO — por aluno (super_admin only)
#
# Retorna dados individuais de cada aluno do tenant:
# ativação, retorno D1/D7, questões respondidas, % acerto,
# dias ativos, último acesso, evolução semanal.
#
# 6 queries SQL totais (sem N+1) — eficiente para até ~5k alunos.
# ══════════════════════════════════════════════════════════════════════════════

@tenants_bp.route("/<string:tenant_id>/tracking/students", methods=["GET"])
@jwt_required()
def get_tenant_tracking_students(tenant_id: str):
    err = _require_super_admin()
    if err: return err

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"error": "not_found"}), 404

    from app.models.question import QuestionAttempt
    from app.models.schedule import ScheduleCheckIn
    from app.models.course import LessonProgress

    BRT = timezone(timedelta(hours=-3))
    now = datetime.now(BRT)
    today_date = now.date()

    # ── 1. Alunos ──────────────────────────────────────────────────────────────
    students_rows = (
        User.query
        .filter_by(tenant_id=tenant_id, role=UserRole.STUDENT.value, is_deleted=False)
        .with_entities(User.id, User.name, User.email, User.created_at, User.is_active)
        .order_by(User.created_at.asc())
        .all()
    )
    student_ids: set[str] = {str(s.id) for s in students_rows}
    student_map = {
        str(s.id): {
            "id": str(s.id), "name": s.name, "email": s.email,
            "is_active": s.is_active,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in students_rows
    }

    # ── 2. Stats de questões por aluno (1 query com GROUP BY) ─────────────────
    qa_rows = (
        db.session.query(
            QuestionAttempt.user_id,
            func.count(QuestionAttempt.id).label("total"),
            func.sum(case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
        )
        .filter(QuestionAttempt.tenant_id == tenant_id)
        .group_by(QuestionAttempt.user_id)
        .all()
    )
    qa_stats: dict[str, dict] = {
        str(r.user_id): {"total": r.total, "correct": int(r.correct or 0)}
        for r in qa_rows
    }

    # ── 3. Check-ins de cronograma por aluno ───────────────────────────────────
    ci_rows = (
        db.session.query(ScheduleCheckIn.user_id, func.count(ScheduleCheckIn.id).label("total"))
        .filter(ScheduleCheckIn.tenant_id == tenant_id)
        .group_by(ScheduleCheckIn.user_id)
        .all()
    )
    ci_stats: dict[str, int] = {str(r.user_id): r.total for r in ci_rows}

    # ── 4. Progresso de aulas por aluno ────────────────────────────────────────
    lp_rows = (
        db.session.query(LessonProgress.user_id, func.count(LessonProgress.id).label("total"))
        .filter(LessonProgress.tenant_id == tenant_id, LessonProgress.status.in_(["watched", "partial"]))
        .group_by(LessonProgress.user_id)
        .all()
    )
    lp_stats: dict[str, int] = {str(r.user_id): r.total for r in lp_rows}

    # ── 5. Datas de atividade por aluno (para D1, D7, first/last access) ───────
    activity_by_user: dict[str, set] = defaultdict(set)
    for model, date_col in [
        (QuestionAttempt, QuestionAttempt.created_at),
        (ScheduleCheckIn, ScheduleCheckIn.created_at),
        (LessonProgress,  LessonProgress.updated_at),
    ]:
        rows = (
            db.session.query(model.user_id, func.date(date_col))
            .filter(model.tenant_id == tenant_id)
            .distinct().all()
        )
        for uid, day in rows:
            uid_str = str(uid)
            if uid_str in student_ids:
                activity_by_user[uid_str].add(day)

    # ── 6. Performance semanal por aluno — últimas 4 semanas ──────────────────
    # Calcula janelas uma vez para todos os alunos
    semanas = []
    for week_i in range(3, -1, -1):
        wend   = now - timedelta(days=7 * week_i)
        wstart = wend - timedelta(days=7)
        semanas.append({
            "label":     "Semana atual" if week_i == 0 else f"Semana -{week_i}",
            "week_start": wstart.date().isoformat(),
            "week_end":   wend.date().isoformat(),
            "start_dt":   wstart,
            "end_dt":     wend,
        })

    # Query de questões por aluno por semana (1 query, GROUP BY user + semana)
    # Usa CASE WHEN para cada semana — mais eficiente que 4 queries separadas
    weekly_rows = (
        db.session.query(
            QuestionAttempt.user_id,
            func.count(QuestionAttempt.id).label("total"),
            func.sum(case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
            # Identifica a semana pelo offset de dias
            case(
                (QuestionAttempt.created_at >= semanas[3]["start_dt"], 3),  # semana atual
                (QuestionAttempt.created_at >= semanas[2]["start_dt"], 2),
                (QuestionAttempt.created_at >= semanas[1]["start_dt"], 1),
                else_=0,
            ).label("week_idx"),
        )
        .filter(
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.created_at >= semanas[0]["start_dt"],
        )
        .group_by(QuestionAttempt.user_id, "week_idx")
        .all()
    )

    # Organiza: { user_id: { week_idx: {total, correct} } }
    weekly_by_user: dict[str, dict] = defaultdict(lambda: {0: {}, 1: {}, 2: {}, 3: {}})
    for r in weekly_rows:
        uid_str = str(r.user_id)
        if uid_str in student_ids:
            weekly_by_user[uid_str][r.week_idx] = {
                "total": r.total, "correct": int(r.correct or 0)
            }

    # ── Monta resultado por aluno ──────────────────────────────────────────────
    result = []
    for uid, info in student_map.items():
        days = activity_by_user.get(uid, set())
        activated = bool(days)
        first_activity = min(days).isoformat() if days else None
        last_activity  = max(days).isoformat() if days else None
        days_active    = len(days)

        # D1 / D7
        retornou_d1 = False
        retornou_d7 = False
        if days:
            first_day = min(days)
            days_since = (today_date - first_day).days
            if days_since >= 1:
                retornou_d1 = (first_day + timedelta(days=1)) in days
            if days_since >= 7:
                retornou_d7 = bool({first_day + timedelta(days=i) for i in range(1, 8)} & days)

        # Questões
        qa = qa_stats.get(uid, {"total": 0, "correct": 0})
        accuracy = round(qa["correct"] / qa["total"] * 100, 1) if qa["total"] > 0 else 0.0

        # Performance semanal
        perf_semanal = []
        for s_idx, s_info in enumerate(semanas):
            w = weekly_by_user.get(uid, {}).get(s_idx, {})
            total_q   = w.get("total", 0)
            correct_q = w.get("correct", 0)
            perf_semanal.append({
                "label":           s_info["label"],
                "week_start":      s_info["week_start"],
                "week_end":        s_info["week_end"],
                "total_questions": total_q,
                "correct":         correct_q,
                "accuracy_pct":    round(correct_q / total_q * 100, 1) if total_q > 0 else 0.0,
            })

        result.append({
            **info,
            "activated":          activated,
            "first_activity":     first_activity,
            "last_activity":      last_activity,
            "days_active":        days_active,
            "retornou_d1":        retornou_d1,
            "retornou_d7":        retornou_d7,
            # Funcionalidades
            "total_questions":    qa["total"],
            "correct_questions":  qa["correct"],
            "accuracy_pct":       accuracy,
            "schedule_checkins":  ci_stats.get(uid, 0),
            "lessons_watched":    lp_stats.get(uid, 0),
            # Performance semanal individual
            "performance_semanal": perf_semanal,
        })

    # Ordena: alunos ativos primeiro, depois por último acesso desc
    result.sort(key=lambda x: (
        not x["activated"],
        x["last_activity"] or "" ,
    ), reverse=False)
    result.sort(key=lambda x: x["last_activity"] or "", reverse=True)
    result.sort(key=lambda x: not x["activated"])

    return jsonify({
        "tenant_id":   tenant_id,
        "tenant_name": tenant.name,
        "computed_at": now.isoformat(),
        "total":       len(result),
        "students":    result,
    }), 200