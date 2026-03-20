# api/app/routes/schedule.py
# Rotas do cronograma inteligente.
# Geração, visualização, check-in e reorganização.

from datetime import datetime, timezone, date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE

from app.extensions import db, limiter
from app.models.user import User, UserRole
from app.models.course import CourseEnrollment, Lesson, Subject
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn
from app.services.schedule_engine import ScheduleEngine
from app.middleware.tenant import (
    resolve_tenant,
    require_tenant,
    require_feature,
    get_current_tenant,
)

schedule_bp = Blueprint("schedule", __name__)

# ── Schemas ───────────────────────────────────────────────────────────────────


class GenerateScheduleSchema(Schema):
    course_id = fields.Str(required=True)
    target_date = fields.Date(
        allow_none=True,
        load_default=None,
        format="%Y-%m-%d",
    )

    class Meta:
        unknown = EXCLUDE


class UpdateAvailabilitySchema(Schema):
    """Atualiza disponibilidade de estudo do aluno."""

    days = fields.List(
        fields.Int(validate=validate.Range(min=0, max=6)),
        required=True,
        validate=validate.Length(min=1, max=7),
    )
    hours_per_day = fields.Float(
        required=True,
        validate=validate.Range(min=0.5, max=12.0),
    )
    preferred_start_time = fields.Str(
        load_default="08:00",
        validate=validate.Regexp(r"^\d{2}:\d{2}$"),
    )

    class Meta:
        unknown = EXCLUDE


class CheckInSchema(Schema):
    completed = fields.Bool(required=True)
    note = fields.Str(
        allow_none=True, load_default=None, validate=validate.Length(max=500)
    )
    perceived_difficulty = fields.Str(
        allow_none=True,
        load_default=None,
        validate=validate.OneOf(["easy", "ok", "hard"]),
    )

    class Meta:
        unknown = EXCLUDE


# ── Before request ────────────────────────────────────────────────────────────


@schedule_bp.before_request
def before_request():
    resolve_tenant()


# ══════════════════════════════════════════════════════════════════════════════
# GERAR / OBTER CRONOGRAMA
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/generate", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("10 per hour")
def generate_schedule():
    """
    Gera ou reorganiza o cronograma inteligente do aluno.

    O motor:
    1. Analisa disponibilidade (dias/horas)
    2. Analisa performance por disciplina (pontos fracos)
    3. Coleta aulas pendentes
    4. Distribui e prioriza nos dias disponíveis
    5. Intercala questões e revisões nos pontos fracos
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    schema = GenerateScheduleSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    # Verifica matrícula
    enrollment = CourseEnrollment.query.filter_by(
        user_id=user_id,
        course_id=data["course_id"],
        tenant_id=tenant.id,
        is_active=True,
        is_deleted=False,
    ).first()
    if not enrollment:
        return (
            jsonify(
                {
                    "error": "not_enrolled",
                    "message": "Você não está matriculado neste curso.",
                }
            ),
            403,
        )

    target_date = data["target_date"].isoformat() if data.get("target_date") else None

    engine = ScheduleEngine(
        user_id=user_id,
        tenant_id=tenant.id,
        course_id=data["course_id"],
    )

    schedule = engine.generate(target_date=target_date)

    # Calcula risco de abandono e salva no schedule
    risk = engine.calculate_abandonment_risk()
    schedule.abandonment_risk_score = risk
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Cronograma gerado com sucesso.",
                "schedule": _serialize_schedule(schedule),
                "abandonment_risk": risk,
            }
        ),
        201,
    )


@schedule_bp.route("/", methods=["GET"])
@jwt_required()
@require_tenant
def get_my_schedule():
    """
    Retorna o cronograma do aluno com agrupamento por dia.

    Query params:
    - course_id (obrigatório)
    - days_ahead: quantos dias mostrar (default: 7, max: 30)
    - include_past: incluir dias passados (default: false)
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    course_id = request.args.get("course_id")
    if not course_id:
        return jsonify({"error": "course_id obrigatório"}), 400

    days_ahead = min(int(request.args.get("days_ahead", 7)), 30)
    include_past = request.args.get("include_past", "false").lower() == "true"

    schedule = StudySchedule.query.filter_by(
        user_id=user_id,
        course_id=course_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    if not schedule:
        return (
            jsonify(
                {
                    "schedule": None,
                    "message": "Nenhum cronograma encontrado. Use /schedule/generate para criar.",
                }
            ),
            200,
        )

    today = date.today()
    end_date = today + timedelta(days=days_ahead)

    # Filtra itens pelo período
    query = ScheduleItem.query.filter(
        ScheduleItem.schedule_id == schedule.id,
        ScheduleItem.is_deleted == False,
    )

    if not include_past:
        query = query.filter(ScheduleItem.scheduled_date >= today.isoformat())

    query = query.filter(ScheduleItem.scheduled_date <= end_date.isoformat())
    items = query.order_by(
        ScheduleItem.scheduled_date,
        ScheduleItem.order,
    ).all()

    # Agrupa por dia
    days_map: dict = {}
    for item in items:
        day = item.scheduled_date
        if day not in days_map:
            days_map[day] = {
                "date": day,
                "is_today": day == today.isoformat(),
                "is_past": day < today.isoformat(),
                "total_minutes": 0,
                "completed_minutes": 0,
                "items": [],
            }
        days_map[day]["items"].append(_serialize_item(item))
        days_map[day]["total_minutes"] += item.estimated_minutes or 0
        if item.status == "done":
            days_map[day]["completed_minutes"] += item.estimated_minutes or 0

    # Adiciona progresso do dia
    for day_data in days_map.values():
        total = day_data["total_minutes"]
        done = day_data["completed_minutes"]
        day_data["completion_rate"] = round((done / total) * 100, 1) if total else 0
        day_data["pending_count"] = sum(
            1 for i in day_data["items"] if i["status"] == "pending"
        )

    # Ordena dias cronologicamente
    sorted_days = sorted(days_map.values(), key=lambda d: d["date"])

    # Stats gerais do cronograma
    total_items = ScheduleItem.query.filter_by(
        schedule_id=schedule.id,
        is_deleted=False,
    ).count()

    done_items = ScheduleItem.query.filter_by(
        schedule_id=schedule.id,
        status="done",
        is_deleted=False,
    ).count()

    overdue_items = ScheduleItem.query.filter(
        ScheduleItem.schedule_id == schedule.id,
        ScheduleItem.scheduled_date < today.isoformat(),
        ScheduleItem.status == "pending",
        ScheduleItem.is_deleted == False,
    ).count()

    return (
        jsonify(
            {
                "schedule": {
                    **_serialize_schedule(schedule),
                    "stats": {
                        "total_items": total_items,
                        "done_items": done_items,
                        "overdue_items": overdue_items,
                        "completion_rate": (
                            round((done_items / total_items) * 100, 1)
                            if total_items
                            else 0
                        ),
                    },
                },
                "days": sorted_days,
                "today": today.isoformat(),
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# CHECK-IN
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/items/<string:item_id>/checkin", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("60 per hour")
def checkin_item(item_id: str):
    """
    Aluno faz check-in em um item do cronograma.
    Informa: completou ou não, dificuldade percebida, nota.

    Após o check-in:
    - Atualiza status do item
    - Atualiza LessonProgress se for uma aula
    - Verifica se deve reorganizar o cronograma
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    item = ScheduleItem.query.filter(
        ScheduleItem.id == item_id,
        ScheduleItem.tenant_id == tenant.id,
        ScheduleItem.is_deleted == False,
    ).first()

    if not item:
        return jsonify({"error": "not_found"}), 404

    # SEGURANÇA: Garante que o item pertence ao cronograma do usuário
    schedule = StudySchedule.query.filter_by(
        id=item.schedule_id,
        user_id=user_id,
        is_deleted=False,
    ).first()
    if not schedule:
        return jsonify({"error": "forbidden"}), 403

    schema = CheckInSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    now_iso = datetime.now(timezone.utc).isoformat()

    # Cria ou atualiza check-in
    checkin = ScheduleCheckIn.query.filter_by(
        item_id=item.id,
        is_deleted=False,
    ).first()

    if not checkin:
        checkin = ScheduleCheckIn(
            tenant_id=tenant.id,
            item_id=item.id,
            user_id=user_id,
            completed=data["completed"],
            note=data.get("note"),
            perceived_difficulty=data.get("perceived_difficulty"),
            checked_in_at=now_iso,
        )
        db.session.add(checkin)
    else:
        checkin.completed = data["completed"]
        checkin.note = data.get("note", checkin.note)
        checkin.perceived_difficulty = data.get(
            "perceived_difficulty", checkin.perceived_difficulty
        )
        checkin.checked_in_at = now_iso

    # Atualiza status do item
    item.status = "done" if data["completed"] else "skipped"

    # Se for aula, atualiza LessonProgress
    if item.item_type == "lesson" and item.lesson_id:
        from app.models.course import LessonProgress

        progress = LessonProgress.query.filter_by(
            lesson_id=item.lesson_id,
            user_id=user_id,
            tenant_id=tenant.id,
        ).first()

        if not progress:
            progress = LessonProgress(
                tenant_id=tenant.id,
                lesson_id=item.lesson_id,
                user_id=user_id,
            )
            db.session.add(progress)

        progress.status = "watched" if data["completed"] else "not_watched"
        progress.last_watched_at = now_iso
        if data["completed"]:
            progress.watch_percentage = 1.0

    db.session.commit()

    # Verifica se deve reorganizar o cronograma
    should_reorganize = False
    reorganize_reason = None

    if not data["completed"]:
        # Conta quantos itens seguidos foram pulados
        recent_skipped = (
            ScheduleItem.query.filter(
                ScheduleItem.schedule_id == schedule.id,
                ScheduleItem.status == "skipped",
                ScheduleItem.is_deleted == False,
            )
            .order_by(ScheduleItem.scheduled_date.desc())
            .limit(5)
            .all()
        )

        if len(recent_skipped) >= 3:
            should_reorganize = True
            reorganize_reason = "3 ou mais itens pulados consecutivamente"

    # Detecta atraso: itens pendentes de dias anteriores
    today_str = date.today().isoformat()
    overdue_count = ScheduleItem.query.filter(
        ScheduleItem.schedule_id == schedule.id,
        ScheduleItem.scheduled_date < today_str,
        ScheduleItem.status == "pending",
        ScheduleItem.is_deleted == False,
    ).count()

    if overdue_count >= 5:
        should_reorganize = True
        reorganize_reason = f"{overdue_count} itens atrasados detectados"

    # Reorganização automática (não bloqueia a resposta — ideal seria Celery task)
    if should_reorganize:
        try:
            engine = ScheduleEngine(
                user_id=user_id,
                tenant_id=tenant.id,
                course_id=schedule.course_id,
            )
            engine.reorganize(schedule)
            risk = engine.calculate_abandonment_risk()
            schedule.abandonment_risk_score = risk
            db.session.commit()
        except Exception:
            pass  # Não falha o check-in por causa da reorganização

    return (
        jsonify(
            {
                "message": "Check-in registrado.",
                "item_status": item.status,
                "completed": data["completed"],
                "schedule_reorganized": should_reorganize,
                "reorganize_reason": reorganize_reason if should_reorganize else None,
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# REORGANIZAÇÃO MANUAL
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/reorganize", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("5 per hour")
def reorganize_schedule():
    """
    Reorganização manual do cronograma.
    Útil quando aluno muda disponibilidade ou quer reiniciar o plano.
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    course_id = (request.get_json(force=True) or {}).get("course_id")
    if not course_id:
        return jsonify({"error": "course_id obrigatório"}), 400

    engine = ScheduleEngine(
        user_id=user_id,
        tenant_id=tenant.id,
        course_id=course_id,
    )

    schedule = engine.reorganize()
    risk = engine.calculate_abandonment_risk()
    schedule.abandonment_risk_score = risk
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Cronograma reorganizado com sucesso.",
                "schedule": _serialize_schedule(schedule),
                "abandonment_risk": risk,
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# DISPONIBILIDADE
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/availability", methods=["PUT"])
@jwt_required()
@require_tenant
def update_availability():
    """
    Atualiza disponibilidade de estudo do aluno.
    Após atualizar, reorganiza automaticamente o cronograma ativo.
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    schema = UpdateAvailabilitySchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    user = User.query.filter_by(
        id=user_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    user.study_availability = {
        "days": data["days"],
        "hours_per_day": data["hours_per_day"],
        "preferred_start_time": data["preferred_start_time"],
    }
    db.session.commit()

    # Reorganiza todos os cronogramas ativos do aluno
    active_schedules = StudySchedule.query.filter_by(
        user_id=user_id,
        tenant_id=tenant.id,
        status="active",
        is_deleted=False,
    ).all()

    reorganized = []
    for schedule in active_schedules:
        engine = ScheduleEngine(
            user_id=user_id,
            tenant_id=tenant.id,
            course_id=schedule.course_id,
        )
        engine.reorganize(schedule)
        reorganized.append(schedule.course_id)

    db.session.commit()

    day_names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
    selected_days = [day_names[d] for d in data["days"] if d < 7]

    return (
        jsonify(
            {
                "message": "Disponibilidade atualizada.",
                "availability": {
                    "days": data["days"],
                    "days_names": selected_days,
                    "hours_per_day": data["hours_per_day"],
                    "preferred_start_time": data["preferred_start_time"],
                    "weekly_hours": len(data["days"]) * data["hours_per_day"],
                },
                "schedules_reorganized": len(reorganized),
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# RISCO DE ABANDONO (para o produtor)
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/risk/<string:user_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_abandonment_risk(user_id: str):
    """
    Retorna o risco de abandono de um aluno específico.
    Apenas produtor ou acima.
    """
    claims = get_jwt()
    if claims.get("role") not in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    ):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    course_id = request.args.get("course_id")
    if not course_id:
        return jsonify({"error": "course_id obrigatório"}), 400

    # SEGURANÇA: Garante que o aluno pertence ao tenant
    student = User.query.filter_by(
        id=user_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not student:
        return jsonify({"error": "not_found"}), 404

    engine = ScheduleEngine(
        user_id=user_id,
        tenant_id=tenant.id,
        course_id=course_id,
    )
    risk = engine.calculate_abandonment_risk()

    return (
        jsonify(
            {
                "user_id": user_id,
                "name": student.name,
                "abandonment_risk_score": risk,
                "risk_level": (
                    "alto" if risk >= 0.7 else "médio" if risk >= 0.3 else "baixo"
                ),
            }
        ),
        200,
    )


# ── Serializers ───────────────────────────────────────────────────────────────


def _serialize_schedule(schedule: StudySchedule) -> dict:
    return {
        "id": schedule.id,
        "course_id": schedule.course_id,
        "status": schedule.status,
        "target_date": schedule.target_date,
        "availability": schedule.availability_snapshot,
        "abandonment_risk_score": schedule.abandonment_risk_score,
        "risk_level": (
            "alto"
            if schedule.abandonment_risk_score >= 0.7
            else "médio" if schedule.abandonment_risk_score >= 0.3 else "baixo"
        ),
        "ai_notes": schedule.ai_notes,
        "last_reorganized_at": schedule.last_reorganized_at,
        "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
    }


def _serialize_item(item: ScheduleItem) -> dict:
    data = {
        "id": item.id,
        "type": item.item_type,
        "status": item.status,
        "estimated_minutes": item.estimated_minutes,
        "priority_reason": item.priority_reason,
        "scheduled_date": item.scheduled_date,
        "order": item.order,
        "has_checkin": item.checkin is not None,
    }

    if item.lesson_id and item.lesson:
        data["lesson"] = {
            "id": item.lesson.id,
            "title": item.lesson.title,
            "duration_minutes": item.lesson.duration_minutes,
            "video_url": item.lesson.video_url,
        }

    if item.subject_id and item.subject:
        data["subject"] = {
            "id": item.subject.id,
            "name": item.subject.name,
            "color": item.subject.color,
        }

    return data
