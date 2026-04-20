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
    Retorna métricas de rastreamento do tenant para o painel super_admin.

    Métricas calculadas:
    - DAU / MAU / Stickiness
    - Taxa de Ativação (alunos com ao menos 1 evento-chave)
    - Retorno D1 / D7
    - Uso por funcionalidade (questões, cronograma, aulas)
    - Performance semanal das últimas 4 semanas

    Fontes de dados: QuestionAttempt, ScheduleCheckIn, LessonProgress.
    Todas as queries filtram por tenant_id para garantir isolamento.
    """
    err = _require_super_admin()
    if err: return err

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"error": "not_found"}), 404

    from app.models.question import QuestionAttempt
    from app.models.schedule import ScheduleCheckIn
    from app.models.course import LessonProgress

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    thirty_days_ago = now - timedelta(days=30)

    # ── Alunos do tenant ───────────────────────────────────────────────────────
    students = (
        User.query
        .filter_by(tenant_id=tenant_id, role=UserRole.STUDENT.value, is_deleted=False)
        .with_entities(User.id, User.created_at)
        .all()
    )
    total_students = len(students)
    student_ids: set[str] = {str(s.id) for s in students}

    # Map id -> created_at — garante timezone-aware
    student_created: dict[str, datetime] = {}
    for s in students:
        ca = s.created_at
        if ca and ca.tzinfo is None:
            ca = ca.replace(tzinfo=timezone.utc)
        student_created[str(s.id)] = ca

    # ── Helper: usuários ativos em um período (union das 3 tabelas) ────────────
    def _active_user_ids(start: datetime, end: datetime | None = None) -> set[str]:
        """Retorna set de user_ids (students) com atividade no tenant entre start e end."""
        def _q(model, date_col):
            q = db.session.query(distinct(model.user_id)).filter(
                model.tenant_id == tenant_id,
                date_col >= start,
            )
            if end:
                q = q.filter(date_col < end)
            return {str(r[0]) for r in q.all()}

        return (
            _q(QuestionAttempt, QuestionAttempt.created_at)
            | _q(ScheduleCheckIn, ScheduleCheckIn.created_at)
            | _q(LessonProgress,  LessonProgress.updated_at)
        ) & student_ids

    # ── DAU / MAU / Stickiness ─────────────────────────────────────────────────
    dau = len(_active_user_ids(today_start))
    mau = len(_active_user_ids(thirty_days_ago))
    stickiness = round(dau / mau * 100, 1) if mau > 0 else 0.0

    # ── Taxa de Ativação ───────────────────────────────────────────────────────
    epoch = datetime(2020, 1, 1, tzinfo=timezone.utc)
    activated = len(_active_user_ids(epoch))
    taxa_ativacao = round(activated / total_students * 100, 1) if total_students > 0 else 0.0

    # ── Retorno D1 / D7 ────────────────────────────────────────────────────────
    # Constrói mapa user_id -> set de datas ativas (uma query por tabela, sem IN clause)
    activity_by_user: dict[str, set] = defaultdict(set)
    for model, date_col in [
        (QuestionAttempt, QuestionAttempt.created_at),
        (ScheduleCheckIn, ScheduleCheckIn.created_at),
        (LessonProgress,  LessonProgress.updated_at),
    ]:
        rows = (
            db.session.query(model.user_id, func.date(date_col))
            .filter(model.tenant_id == tenant_id)
            .distinct()
            .all()
        )
        for uid, day in rows:
            uid_str = str(uid)
            if uid_str in student_ids:
                activity_by_user[uid_str].add(day)

    d1_eligible = [uid for uid, ca in student_created.items() if ca and (now - ca).days >= 1]
    d7_eligible = [uid for uid, ca in student_created.items() if ca and (now - ca).days >= 7]

    d1_returned = sum(
        1 for uid in d1_eligible
        if (student_created[uid] + timedelta(days=1)).date() in activity_by_user.get(uid, set())
    )
    d7_returned = sum(
        1 for uid in d7_eligible
        if {(student_created[uid] + timedelta(days=i)).date() for i in range(1, 8)} & activity_by_user.get(uid, set())
    )

    retorno_d1 = round(d1_returned / len(d1_eligible) * 100, 1) if d1_eligible else 0.0
    retorno_d7 = round(d7_returned / len(d7_eligible) * 100, 1) if d7_eligible else 0.0

    # ── Uso por funcionalidade ─────────────────────────────────────────────────
    qa_total = db.session.query(func.count(QuestionAttempt.id)).filter(
        QuestionAttempt.tenant_id == tenant_id
    ).scalar() or 0

    ci_total = db.session.query(func.count(ScheduleCheckIn.id)).filter(
        ScheduleCheckIn.tenant_id == tenant_id
    ).scalar() or 0

    lp_total = db.session.query(func.count(LessonProgress.id)).filter(
        LessonProgress.tenant_id == tenant_id,
        LessonProgress.status.in_(["watched", "partial"]),
    ).scalar() or 0

    total_events = qa_total + ci_total + lp_total

    def _pct(val: int) -> float:
        return round(val / total_events * 100, 1) if total_events > 0 else 0.0

    uso_funcionalidades = {
        "questoes":   {"label": "Questões",   "count": qa_total, "pct": _pct(qa_total)},
        "cronograma": {"label": "Cronograma", "count": ci_total, "pct": _pct(ci_total)},
        "aulas":      {"label": "Aulas",      "count": lp_total, "pct": _pct(lp_total)},
    }

    # ── Performance semanal — últimas 4 semanas ────────────────────────────────
    performance_semanal = []
    for week_i in range(3, -1, -1):   # 3 = mais antiga → 0 = semana atual
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

        total_q   = row.total   or 0
        correct_q = int(row.correct or 0)
        accuracy  = round(correct_q / total_q * 100, 1) if total_q > 0 else 0.0
        label = "Semana atual" if week_i == 0 else f"Semana -{week_i}"

        performance_semanal.append({
            "label":           label,
            "week_start":      week_start.date().isoformat(),
            "week_end":        week_end.date().isoformat(),
            "total_questions": total_q,
            "correct":         correct_q,
            "accuracy_pct":    accuracy,
        })

    return jsonify({
        "tenant_id":           tenant_id,
        "tenant_name":         tenant.name,
        "computed_at":         now.isoformat(),
        "total_students":      total_students,
        # Engajamento
        "dau":                 dau,
        "mau":                 mau,
        "stickiness":          stickiness,
        "taxa_ativacao":       taxa_ativacao,
        "retorno_d1":          retorno_d1,
        "retorno_d7":          retorno_d7,
        # Uso
        "uso_funcionalidades": uso_funcionalidades,
        "total_events":        total_events,
        # Performance
        "performance_semanal": performance_semanal,
    }), 200