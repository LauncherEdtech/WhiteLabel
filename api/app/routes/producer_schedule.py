# api/app/routes/producer_schedule.py
# Rotas para gerenciamento de cronograma pré-definido pelo infoprodutor.
#
# PRODUTOR:
#   POST   /producer-schedule/templates              → Criar template para um curso
#   GET    /producer-schedule/templates/<course_id>  → Buscar template do curso
#   PUT    /producer-schedule/templates/<id>         → Atualizar configurações
#   DELETE /producer-schedule/templates/<id>         → Deletar template
#   POST   /producer-schedule/templates/<id>/items   → Adicionar item ao template
#   PUT    /producer-schedule/templates/<id>/items/<item_id>  → Editar item
#   DELETE /producer-schedule/templates/<id>/items/<item_id>  → Remover item
#   POST   /producer-schedule/templates/<id>/reorder → Reordenar itens
#   POST   /producer-schedule/templates/<id>/publish → Publicar/despublicar
#
# ALUNO:
#   GET    /producer-schedule/course/<course_id>     → Ver template disponível
#   POST   /producer-schedule/adopt                  → Adotar template como cronograma

from datetime import date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE

from app.extensions import db
from app.models.user import UserRole
from app.models.course import Course, Lesson, Subject, CourseEnrollment, Module
from app.models.schedule import StudySchedule, ScheduleItem
from app.models.producer_schedule import (
    ProducerScheduleTemplate,
    ProducerScheduleTemplateItem,
)
from app.middleware.tenant import resolve_tenant, require_tenant, get_current_tenant

producer_schedule_bp = Blueprint("producer_schedule", __name__)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _require_producer(claims: dict):
    if claims.get("role") not in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    ):
        return jsonify({"error": "forbidden", "message": "Acesso negado."}), 403
    return None


def _require_student(claims: dict):
    if claims.get("role") != UserRole.STUDENT.value:
        return jsonify({"error": "forbidden", "message": "Apenas alunos."}), 403
    return None


# ── Schemas ───────────────────────────────────────────────────────────────────


class CreateTemplateSchema(Schema):
    course_id = fields.Str(required=True)
    title = fields.Str(
        load_default="Cronograma do Curso", validate=validate.Length(max=255)
    )
    description = fields.Str(allow_none=True, load_default=None)
    allow_student_custom_schedule = fields.Bool(load_default=True)

    class Meta:
        unknown = EXCLUDE


class UpdateTemplateSchema(Schema):
    title = fields.Str(validate=validate.Length(max=255))
    description = fields.Str(allow_none=True)
    allow_student_custom_schedule = fields.Bool()

    class Meta:
        unknown = EXCLUDE


class TemplateItemSchema(Schema):
    day_number = fields.Int(required=True, validate=validate.Range(min=1, max=365))
    order = fields.Int(load_default=0)
    item_type = fields.Str(
        required=True,
        validate=validate.OneOf(["lesson", "questions", "review", "simulado"]),
    )
    title = fields.Str(
        allow_none=True, load_default=None, validate=validate.Length(max=255)
    )
    notes = fields.Str(allow_none=True, load_default=None)
    lesson_id = fields.Str(allow_none=True, load_default=None)
    subject_id = fields.Str(allow_none=True, load_default=None)
    estimated_minutes = fields.Int(
        load_default=30, validate=validate.Range(min=5, max=480)
    )
    question_filters = fields.Dict(allow_none=True, load_default=None)

    class Meta:
        unknown = EXCLUDE


class ReorderSchema(Schema):
    items = fields.List(
        fields.Dict(keys=fields.Str(), values=fields.Raw()),
        required=True,
    )

    class Meta:
        unknown = EXCLUDE


@producer_schedule_bp.before_request
def before_request():
    resolve_tenant()


# ══════════════════════════════════════════════════════════════════════════════
# ROTAS DO PRODUTOR
# ══════════════════════════════════════════════════════════════════════════════


@producer_schedule_bp.route("/templates", methods=["POST"])
@jwt_required()
@require_tenant
def create_template():
    """Cria um novo template de cronograma para um curso."""
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()

    try:
        data = CreateTemplateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "messages": e.messages}), 400

    # Verifica que o curso pertence ao tenant
    course = Course.query.filter_by(
        id=data["course_id"], tenant_id=tenant.id, is_deleted=False
    ).first()
    if not course:
        return jsonify({"error": "not_found", "message": "Curso não encontrado."}), 404

    # Verifica se já existe template para este curso
    existing = ProducerScheduleTemplate.query.filter_by(
        course_id=course.id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if existing:
        return (
            jsonify(
                {
                    "error": "already_exists",
                    "message": "Já existe um template para este curso.",
                    "template": _serialize_template(existing),
                }
            ),
            409,
        )

    template = ProducerScheduleTemplate(
        tenant_id=tenant.id,
        course_id=course.id,
        title=data["title"],
        description=data["description"],
        allow_student_custom_schedule=data["allow_student_custom_schedule"],
        is_published=False,
        total_days=0,
    )
    db.session.add(template)
    db.session.commit()

    return jsonify({"template": _serialize_template(template, include_items=True)}), 201


@producer_schedule_bp.route("/templates/by-course/<string:course_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_template_by_course(course_id: str):
    """Retorna o template de cronograma de um curso (produtor)."""
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()

    template = ProducerScheduleTemplate.query.filter_by(
        course_id=course_id, tenant_id=tenant.id, is_deleted=False
    ).first()

    if not template:
        return jsonify({"template": None}), 200

    return jsonify({"template": _serialize_template(template, include_items=True)}), 200


@producer_schedule_bp.route("/templates/<string:template_id>", methods=["PUT"])
@jwt_required()
@require_tenant
def update_template(template_id: str):
    """Atualiza configurações do template."""
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    template = _get_template_or_404(template_id, tenant.id)
    if isinstance(template, tuple):
        return template

    try:
        data = UpdateTemplateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "messages": e.messages}), 400

    raw = request.get_json(force=True) or {}
    if "title" in raw:
        template.title = data["title"]
    if "description" in raw:
        template.description = data.get("description")
    if "allow_student_custom_schedule" in raw:
        template.allow_student_custom_schedule = data["allow_student_custom_schedule"]

    db.session.commit()
    return jsonify({"template": _serialize_template(template)}), 200


@producer_schedule_bp.route("/templates/<string:template_id>/publish", methods=["POST"])
@jwt_required()
@require_tenant
def toggle_publish(template_id: str):
    """Publica ou despublica o template (torna visível/invisível para alunos)."""
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    template = _get_template_or_404(template_id, tenant.id)
    if isinstance(template, tuple):
        return template

    if not template.is_published and template.total_days == 0:
        return (
            jsonify(
                {
                    "error": "empty_template",
                    "message": "Adicione pelo menos 1 item antes de publicar.",
                }
            ),
            400,
        )

    template.is_published = not template.is_published
    db.session.commit()

    return (
        jsonify(
            {
                "is_published": template.is_published,
                "message": (
                    "Cronograma publicado!"
                    if template.is_published
                    else "Cronograma despublicado."
                ),
            }
        ),
        200,
    )


@producer_schedule_bp.route("/templates/<string:template_id>", methods=["DELETE"])
@jwt_required()
@require_tenant
def delete_template(template_id: str):
    """Remove o template (soft delete)."""
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    template = _get_template_or_404(template_id, tenant.id)
    if isinstance(template, tuple):
        return template

    template.soft_delete()
    db.session.commit()
    return jsonify({"message": "Template removido."}), 200


# ── Items ─────────────────────────────────────────────────────────────────────


@producer_schedule_bp.route("/templates/<string:template_id>/items", methods=["POST"])
@jwt_required()
@require_tenant
def add_item(template_id: str):
    """Adiciona um item ao template."""
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    template = _get_template_or_404(template_id, tenant.id)
    if isinstance(template, tuple):
        return template

    try:
        data = TemplateItemSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "messages": e.messages}), 400

    # Validações por tipo
    if data["item_type"] == "lesson":
        if not data.get("lesson_id"):
            return jsonify({"error": "lesson_id obrigatório para tipo 'lesson'"}), 400
        lesson = Lesson.query.filter_by(
            id=data["lesson_id"], tenant_id=tenant.id, is_deleted=False
        ).first()
        if not lesson:
            return jsonify({"error": "Aula não encontrada."}), 404
        # Usa duração real da aula se disponível
        if not data["estimated_minutes"] or data["estimated_minutes"] == 30:
            data["estimated_minutes"] = lesson.duration_minutes or 30
        if not data["title"]:
            data["title"] = lesson.title

    elif data["item_type"] in ("questions", "review"):
        if not data.get("subject_id"):
            return (
                jsonify(
                    {"error": "subject_id obrigatório para tipo 'questions'/'review'"}
                ),
                400,
            )
        subject = Subject.query.filter_by(
            id=data["subject_id"], tenant_id=tenant.id, is_deleted=False
        ).first()
        if not subject:
            return jsonify({"error": "Disciplina não encontrada."}), 404
        if not data["title"]:
            prefix = "Questões" if data["item_type"] == "questions" else "Revisão"
            data["title"] = f"{prefix}: {subject.name}"

    item = ProducerScheduleTemplateItem(
        tenant_id=tenant.id,
        template_id=template.id,
        day_number=data["day_number"],
        order=data["order"],
        item_type=data["item_type"],
        title=data["title"],
        notes=data["notes"],
        lesson_id=data.get("lesson_id"),
        subject_id=data.get("subject_id"),
        estimated_minutes=data["estimated_minutes"],
        question_filters=data.get("question_filters"),
    )
    db.session.add(item)

    # Atualiza total_days do template
    template.total_days = max(template.total_days, data["day_number"])
    db.session.commit()

    return jsonify({"item": _serialize_item(item)}), 201


@producer_schedule_bp.route(
    "/templates/<string:template_id>/items/<string:item_id>", methods=["PUT"]
)
@jwt_required()
@require_tenant
def update_item(template_id: str, item_id: str):
    """Atualiza um item do template."""
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    template = _get_template_or_404(template_id, tenant.id)
    if isinstance(template, tuple):
        return template

    item = ProducerScheduleTemplateItem.query.filter_by(
        id=item_id, template_id=template.id, is_deleted=False
    ).first()
    if not item:
        return jsonify({"error": "not_found"}), 404

    try:
        data = TemplateItemSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "messages": e.messages}), 400

    raw = request.get_json(force=True) or {}
    for field in (
        "day_number",
        "order",
        "item_type",
        "title",
        "notes",
        "lesson_id",
        "subject_id",
        "estimated_minutes",
        "question_filters",
    ):
        if field in raw:
            setattr(item, field, data.get(field))

    # Recalcula total_days
    max_day = (
        db.session.query(db.func.max(ProducerScheduleTemplateItem.day_number))
        .filter_by(template_id=template.id, is_deleted=False)
        .scalar()
        or 0
    )
    template.total_days = max_day

    db.session.commit()
    return jsonify({"item": _serialize_item(item)}), 200


@producer_schedule_bp.route(
    "/templates/<string:template_id>/items/<string:item_id>", methods=["DELETE"]
)
@jwt_required()
@require_tenant
def delete_item(template_id: str, item_id: str):
    """Remove um item do template."""
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    template = _get_template_or_404(template_id, tenant.id)
    if isinstance(template, tuple):
        return template

    item = ProducerScheduleTemplateItem.query.filter_by(
        id=item_id, template_id=template.id, is_deleted=False
    ).first()
    if not item:
        return jsonify({"error": "not_found"}), 404

    item.soft_delete()

    # Recalcula total_days
    max_day = (
        db.session.query(db.func.max(ProducerScheduleTemplateItem.day_number))
        .filter_by(template_id=template.id, is_deleted=False)
        .scalar()
        or 0
    )
    template.total_days = max_day

    db.session.commit()
    return jsonify({"message": "Item removido."}), 200


@producer_schedule_bp.route("/templates/<string:template_id>/reorder", methods=["POST"])
@jwt_required()
@require_tenant
def reorder_items(template_id: str):
    """
    Reordena itens do template.
    Body: { "items": [{ "id": "...", "day_number": 1, "order": 0 }, ...] }
    """
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    template = _get_template_or_404(template_id, tenant.id)
    if isinstance(template, tuple):
        return template

    body = request.get_json(force=True) or {}
    items_data = body.get("items", [])

    for item_data in items_data:
        item = ProducerScheduleTemplateItem.query.filter_by(
            id=item_data.get("id"),
            template_id=template.id,
            is_deleted=False,
        ).first()
        if item:
            item.day_number = item_data.get("day_number", item.day_number)
            item.order = item_data.get("order", item.order)

    max_day = (
        db.session.query(db.func.max(ProducerScheduleTemplateItem.day_number))
        .filter_by(template_id=template.id, is_deleted=False)
        .scalar()
        or 0
    )
    template.total_days = max_day

    db.session.commit()
    return (
        jsonify(
            {
                "message": "Ordem atualizada.",
                "template": _serialize_template(template, include_items=True),
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# ROTAS DO ALUNO
# ══════════════════════════════════════════════════════════════════════════════


@producer_schedule_bp.route("/course/<string:course_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_course_template(course_id: str):
    """
    Aluno consulta o template disponível para um curso.
    Retorna o template publicado (se existir) + opções de adoção.
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    # Verifica matrícula
    enrollment = CourseEnrollment.query.filter_by(
        user_id=user_id,
        course_id=course_id,
        tenant_id=tenant.id,
        is_active=True,
        is_deleted=False,
    ).first()
    if not enrollment:
        return jsonify({"error": "not_enrolled"}), 403

    template = ProducerScheduleTemplate.query.filter_by(
        course_id=course_id,
        tenant_id=tenant.id,
        is_published=True,
        is_deleted=False,
    ).first()

    if not template:
        return jsonify({"template": None, "allow_custom": True}), 200

    # Verifica se aluno já tem cronograma ativo para este curso
    existing_schedule = StudySchedule.query.filter_by(
        user_id=user_id,
        course_id=course_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    return (
        jsonify(
            {
                "template": _serialize_template(template, include_items=True),
                "allow_custom": template.allow_student_custom_schedule,
                "already_adopted": (
                    existing_schedule is not None
                    and existing_schedule.source_type == "producer_template"
                    and existing_schedule.template_id == template.id
                ),
                "has_custom_schedule": (
                    existing_schedule is not None
                    and existing_schedule.source_type == "ai"
                ),
            }
        ),
        200,
    )


@producer_schedule_bp.route("/adopt", methods=["POST"])
@jwt_required()
@require_tenant
def adopt_template():
    """
    Aluno adota o cronograma do produtor para um curso.
    - Cria StudySchedule com source_type="producer_template"
    - Gera ScheduleItems com datas reais a partir de hoje
    - Usa study_availability do aluno para pular dias indisponíveis
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()
    claims = get_jwt()

    if claims.get("role") not in (UserRole.STUDENT.value,):
        return jsonify({"error": "forbidden"}), 403

    body = request.get_json(force=True) or {}
    course_id = body.get("course_id")
    if not course_id:
        return jsonify({"error": "course_id obrigatório"}), 400

    # Verifica matrícula
    enrollment = CourseEnrollment.query.filter_by(
        user_id=user_id,
        course_id=course_id,
        tenant_id=tenant.id,
        is_active=True,
        is_deleted=False,
    ).first()
    if not enrollment:
        return jsonify({"error": "not_enrolled"}), 403

    template = ProducerScheduleTemplate.query.filter_by(
        course_id=course_id,
        tenant_id=tenant.id,
        is_published=True,
        is_deleted=False,
    ).first()
    if not template:
        return jsonify({"error": "Nenhum template publicado para este curso."}), 404

    # Remove cronograma existente (se houver) para re-adotar
    existing = StudySchedule.query.filter_by(
        user_id=user_id,
        course_id=course_id,
    ).first()
    if existing:
        # Remove itens futuros pendentes
        ScheduleItem.query.filter(
            ScheduleItem.schedule_id == existing.id,
            ScheduleItem.scheduled_date >= date.today().isoformat(),
            ScheduleItem.status == "pending",
        ).delete()
        existing.is_deleted = False
        existing.source_type = "producer_template"
        existing.template_id = template.id
        schedule = existing
    else:
        from app.models.user import User as UserModel

        user = UserModel.query.get(user_id)
        avail = (user.study_availability or {}) if user else {}

        schedule = StudySchedule(
            tenant_id=tenant.id,
            user_id=user_id,
            course_id=course_id,
            status="active",
            source_type="producer_template",
            template_id=template.id,
            availability_snapshot=avail,
            last_reorganized_at=__import__("datetime")
            .datetime.now(__import__("datetime").timezone.utc)
            .isoformat(),
        )
        db.session.add(schedule)
        db.session.flush()

    # Gera ScheduleItems a partir do template
    _generate_items_from_template(schedule, template, user_id, tenant.id)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Cronograma do professor adotado com sucesso!",
                "schedule_id": schedule.id,
            }
        ),
        201,
    )


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS INTERNOS
# ══════════════════════════════════════════════════════════════════════════════


def _get_template_or_404(template_id: str, tenant_id: str):
    template = ProducerScheduleTemplate.query.filter_by(
        id=template_id, tenant_id=tenant_id, is_deleted=False
    ).first()
    if not template:
        return (
            jsonify({"error": "not_found", "message": "Template não encontrado."}),
            404,
        )
    return template


def _generate_items_from_template(
    schedule: StudySchedule,
    template: ProducerScheduleTemplate,
    user_id: str,
    tenant_id: str,
):
    """
    Mapeia day_number do template para datas reais.
    Respeita study_availability do aluno (dias disponíveis por semana).
    """
    from app.models.user import User as UserModel

    user = UserModel.query.get(user_id)
    avail = (user.study_availability or {}) if user else {}
    available_weekdays = avail.get("days", [0, 1, 2, 3, 4])  # 0=seg, 6=dom

    # Pré-computa mapa day_number → data real
    day_to_date: dict[int, date] = {}
    current_date = date.today()
    day_counter = 1

    if not template.total_days:
        return

    max_day = template.total_days
    advance_days = 0

    while day_counter <= max_day and advance_days < 730:  # max 2 anos
        weekday = current_date.weekday()  # 0=segunda, 6=domingo
        if weekday in available_weekdays:
            day_to_date[day_counter] = current_date
            day_counter += 1
        current_date += timedelta(days=1)
        advance_days += 1

    # Busca todos os itens do template ordenados
    items = (
        ProducerScheduleTemplateItem.query.filter_by(
            template_id=template.id, is_deleted=False
        )
        .order_by(
            ProducerScheduleTemplateItem.day_number,
            ProducerScheduleTemplateItem.order,
        )
        .all()
    )

    schedule_items = []
    for t_item in items:
        scheduled_date = day_to_date.get(t_item.day_number)
        if not scheduled_date:
            continue

        s_item = ScheduleItem(
            tenant_id=tenant_id,
            schedule_id=schedule.id,
            item_type=t_item.item_type,
            lesson_id=t_item.lesson_id,
            subject_id=t_item.subject_id,
            scheduled_date=scheduled_date.isoformat(),
            order=t_item.order,
            estimated_minutes=t_item.estimated_minutes,
            priority_reason=t_item.title or f"Dia {t_item.day_number}",
            status="pending",
            question_filters=t_item.question_filters,
            template_item_title=t_item.title,
            template_item_notes=t_item.notes,
        )
        schedule_items.append(s_item)

    if schedule_items:
        db.session.bulk_save_objects(schedule_items)


# ══════════════════════════════════════════════════════════════════════════════
# SERIALIZERS
# ══════════════════════════════════════════════════════════════════════════════


def _serialize_template(
    template: ProducerScheduleTemplate, include_items: bool = False
) -> dict:
    data = {
        "id": template.id,
        "course_id": template.course_id,
        "title": template.title,
        "description": template.description,
        "allow_student_custom_schedule": template.allow_student_custom_schedule,
        "is_published": template.is_published,
        "total_days": template.total_days,
        "created_at": template.created_at.isoformat() if template.created_at else None,
    }

    if include_items:
        # Agrupa por dia para facilitar o frontend
        days: dict[int, list] = {}
        for item in template.items:
            if item.is_deleted:
                continue
            day_num = item.day_number
            if day_num not in days:
                days[day_num] = []
            days[day_num].append(_serialize_item(item))

        data["days"] = [
            {"day_number": d, "items": items} for d, items in sorted(days.items())
        ]
        data["items_count"] = sum(len(v) for v in days.values())

    return data


def _serialize_item(item: ProducerScheduleTemplateItem) -> dict:
    data = {
        "id": item.id,
        "day_number": item.day_number,
        "order": item.order,
        "item_type": item.item_type,
        "title": item.title,
        "notes": item.notes,
        "estimated_minutes": item.estimated_minutes,
        "question_filters": item.question_filters,
    }

    if item.lesson_id and item.lesson:
        data["lesson"] = {
            "id": item.lesson.id,
            "title": item.lesson.title,
            "duration_minutes": item.lesson.duration_minutes,
        }

    if item.subject_id and item.subject:
        data["subject"] = {
            "id": item.subject.id,
            "name": item.subject.name,
            "color": item.subject.color,
        }

    return data
