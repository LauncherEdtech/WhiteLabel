# api/app/routes/schedule.py
# Rotas do cronograma inteligente e adaptativo.
#
# OTIMIZAÇÕES (v2):
#   - get_schedule: 3 queries COUNT separadas → 1 query com CASE WHEN
#     + pending_today calculado dos items já em memória (sem query extra)
#   - checkin_item: invalida cache Redis do dashboard após commit

from datetime import datetime, timezone, date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE
from sqlalchemy import func, case

from app.extensions import db, limiter
from app.models.user import User, UserRole
from app.models.course import CourseEnrollment, Lesson, Subject
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn
from app.services.schedule_engine import ScheduleEngine
from app.middleware.tenant import (
    resolve_tenant,
    require_tenant,
    get_current_tenant,
)

schedule_bp = Blueprint("schedule", __name__)


# ── Schemas ───────────────────────────────────────────────────────────────────


class GenerateScheduleSchema(Schema):
    course_id = fields.Str(required=True)
    target_date = fields.Str(allow_none=True, load_default=None)  # "YYYY-MM-DD"

    class Meta:
        unknown = EXCLUDE


class UpdateAvailabilitySchema(Schema):
    days = fields.List(fields.Int(validate=validate.Range(min=0, max=6)), required=True)
    hours_per_day = fields.Float(
        required=True, validate=validate.Range(min=0.5, max=12.0)
    )
    preferred_start_time = fields.Str(load_default="08:00")

    class Meta:
        unknown = EXCLUDE


class CheckInSchema(Schema):
    completed = fields.Bool(required=True)
    note = fields.Str(allow_none=True, load_default=None)
    perceived_difficulty = fields.Str(
        allow_none=True,
        load_default=None,
        validate=validate.OneOf(["easy", "ok", "hard"]),
    )

    class Meta:
        unknown = EXCLUDE


@schedule_bp.before_request
def before_request():
    resolve_tenant()


# ══════════════════════════════════════════════════════════════════════════════
# GERAR / OBTER CRONOGRAMA
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/generate", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("30 per hour")
def generate_schedule():
    """
    Gera ou reorganiza o cronograma inteligente.
    Aceita target_date para calcular compressão por data de prova.
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    schema = GenerateScheduleSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    course_id = data["course_id"]
    target_date = data.get("target_date")

    # Garante que o aluno está matriculado
    enrollment = CourseEnrollment.query.filter_by(
        user_id=user_id,
        course_id=course_id,
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

    try:
        engine = ScheduleEngine(
            user_id=user_id, tenant_id=tenant.id, course_id=course_id
        )
        schedule = engine.generate(target_date=target_date)
        risk = engine.calculate_abandonment_risk()
        schedule.abandonment_risk_score = risk
        db.session.commit()
    except ValueError as e:
        return jsonify({"error": "engine_error", "message": str(e)}), 400

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
def get_schedule():
    """
    Retorna os itens do cronograma agrupados por dia.
    Query params:
      course_id — obrigatório
      days      — quantos dias retornar (default: 14)

    OTIMIZAÇÃO: stats calculados com 1 query CASE WHEN + pending_today
    em memória (antes eram 3 queries COUNT separadas).
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    course_id = request.args.get("course_id")
    if not course_id:
        return jsonify({"error": "course_id obrigatório"}), 400

    days_param = int(request.args.get("days", 14))

    schedule = StudySchedule.query.filter_by(
        user_id=user_id,
        course_id=course_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    if not schedule:
        return jsonify({"schedule": None, "days": [], "stats": None}), 200

    today = date.today()
    end_date = today + timedelta(days=days_param)
    today_str = today.isoformat()
    end_str = end_date.isoformat()

    # ── Itens da janela de exibição ───────────────────────────────────────────
    items = (
        ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date >= today_str,
            ScheduleItem.scheduled_date <= end_str,
            ScheduleItem.is_deleted == False,
        )
        .order_by(ScheduleItem.scheduled_date, ScheduleItem.order)
        .all()
    )

    # ── Agrupa por data ───────────────────────────────────────────────────────
    days_map = {}
    for item in items:
        d = item.scheduled_date
        if d not in days_map:
            days_map[d] = []
        days_map[d].append(_serialize_item(item))

    days_list = [
        {"date": d, "items": day_items} for d, day_items in sorted(days_map.items())
    ]

    # ── pending_today: calculado dos items já em memória (sem query extra) ────
    pending_today = sum(
        1 for i in items if i.scheduled_date == today_str and i.status == "pending"
    )

    # ── total e done: 1 query com CASE WHEN (era 2 queries COUNT separadas) ───
    counts_row = (
        db.session.query(
            func.count(ScheduleItem.id).label("total"),
            func.sum(case((ScheduleItem.status == "done", 1), else_=0)).label("done"),
        )
        .filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.is_deleted == False,
        )
        .one()
    )

    total_items = counts_row.total or 0
    done_items = counts_row.done or 0

    stats = {
        "completion_rate": (
            round((done_items / total_items * 100), 1) if total_items else 0
        ),
        "completed_items": done_items,
        "total_items": total_items,
        "pending_today": pending_today,
        "abandonment_risk": schedule.abandonment_risk_score,
        "target_date": schedule.target_date,
        "ai_notes": schedule.ai_notes,
        "last_reorganized_at": schedule.last_reorganized_at,
    }

    return (
        jsonify(
            {
                "schedule": _serialize_schedule(schedule),
                "days": days_list,
                "stats": stats,
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# CHECK-IN
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/checkin/<string:item_id>", methods=["POST"])
@jwt_required()
@require_tenant
def checkin_item(item_id: str):
    """
    Aluno faz check-in num item do cronograma.
    Dispara adaptação assíncrona via Celery.
    Invalida o cache do dashboard após commit.
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    schema = CheckInSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    item = ScheduleItem.query.filter_by(
        id=item_id,
        is_deleted=False,
    ).first()
    if not item:
        return jsonify({"error": "not_found"}), 404

    schedule = StudySchedule.query.filter_by(
        id=item.schedule_id,
        user_id=user_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not schedule:
        return jsonify({"error": "forbidden"}), 403

    now_iso = datetime.now(timezone.utc).isoformat()

    # Atualiza ou cria check-in
    checkin = ScheduleCheckIn.query.filter_by(item_id=item_id, is_deleted=False).first()
    if not checkin:
        checkin = ScheduleCheckIn(
            tenant_id=tenant.id,
            item_id=item_id,
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

    item.status = "done" if data["completed"] else "skipped"

    # Se for aula, sincroniza LessonProgress
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

    # ── Invalida cache do dashboard após commit ───────────────────────────────
    try:
        from app.routes.analytics import _cache_delete, _dashboard_cache_key

        _cache_delete(_dashboard_cache_key(user_id, tenant.id))
    except Exception:
        pass  # Nunca falha o check-in por causa do cache

    # Dispara adaptação assíncrona via Celery
    try:
        from app.tasks.schedule_tasks import adapt_after_checkin

        adapt_after_checkin.delay(
            user_id=user_id,
            tenant_id=tenant.id,
            course_id=schedule.course_id,
            item_id=item_id,
        )
    except Exception:
        pass  # Não falha o check-in se Celery não estiver disponível

    return (
        jsonify(
            {
                "message": "Check-in registrado.",
                "item_status": item.status,
                "completed": data["completed"],
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
    """Reorganização manual — chamada pelo botão na UI."""
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    course_id = (request.get_json(force=True) or {}).get("course_id")
    if not course_id:
        return jsonify({"error": "course_id obrigatório"}), 400

    engine = ScheduleEngine(user_id=user_id, tenant_id=tenant.id, course_id=course_id)
    schedule = engine.reorganize()
    risk = engine.calculate_abandonment_risk()
    schedule.abandonment_risk_score = risk
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Cronograma reorganizado.",
                "schedule": _serialize_schedule(schedule),
                "abandonment_risk": risk,
            }
        ),
        200,
    )


@schedule_bp.route("/", methods=["DELETE"])
@jwt_required()
@require_tenant
def delete_schedule():
    """Remove cronograma do aluno (soft delete)."""
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    course_id = request.args.get("course_id")
    if not course_id:
        return jsonify({"error": "course_id obrigatório"}), 400

    schedule = StudySchedule.query.filter_by(
        user_id=user_id,
        course_id=course_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not schedule:
        return jsonify({"error": "not_found"}), 404

    schedule.soft_delete()
    db.session.commit()

    return jsonify({"message": "Cronograma removido."}), 200


# ══════════════════════════════════════════════════════════════════════════════
# DISPONIBILIDADE
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/availability", methods=["PUT"])
@jwt_required()
@require_tenant
def update_availability():
    """Atualiza disponibilidade e reorganiza cronogramas ativos."""
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
        return jsonify({"error": "not_found"}), 404

    user.study_availability = {
        "days": data["days"],
        "hours_per_day": data["hours_per_day"],
        "preferred_start_time": data.get("preferred_start_time", "08:00"),
    }
    db.session.commit()

    # Reorganiza todos os cronogramas ativos do aluno
    schedules = StudySchedule.query.filter_by(
        user_id=user_id,
        tenant_id=tenant.id,
        status="active",
        is_deleted=False,
    ).all()

    reorganized = 0
    for schedule in schedules:
        try:
            engine = ScheduleEngine(
                user_id=user_id,
                tenant_id=tenant.id,
                course_id=schedule.course_id,
            )
            engine.reorganize(schedule)
            reorganized += 1
        except Exception:
            pass

    return (
        jsonify(
            {
                "message": f"Disponibilidade atualizada. {reorganized} cronograma(s) reorganizado(s).",
                "availability": user.study_availability,
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# SERIALIZERS
# ══════════════════════════════════════════════════════════════════════════════


def _serialize_schedule(schedule: StudySchedule) -> dict:
    return {
        "id": schedule.id,
        "course_id": schedule.course_id,
        "status": schedule.status,
        "source_type": schedule.source_type or "ai",
        "target_date": schedule.target_date,
        "abandonment_risk": schedule.abandonment_risk_score,
        "ai_notes": schedule.ai_notes,
        "last_reorganized_at": schedule.last_reorganized_at,
    }


def _serialize_item(item: ScheduleItem) -> dict:
    data = {
        "id": item.id,
        "item_type": item.item_type,
        "status": item.status,
        "scheduled_date": item.scheduled_date,
        "order": item.order,
        "estimated_minutes": item.estimated_minutes,
        "priority_reason": item.priority_reason,
        "has_checkin": item.checkin is not None,
        "question_filters": item.question_filters,
        "template_item_title": item.template_item_title,
        "template_item_notes": item.template_item_notes,
    }

    if item.lesson_id and item.lesson:
        lesson = item.lesson
        if lesson.video_s3_key:
            from app.routes.uploads import generate_video_presigned_url

            video_url = generate_video_presigned_url(lesson.video_s3_key)
        else:
            video_url = lesson.video_url

        data["lesson"] = {
            "id": lesson.id,
            "title": lesson.title,
            "duration_minutes": lesson.duration_minutes,
            "video_url": video_url,
            "video_hosted": bool(lesson.video_s3_key),
            "external_url": lesson.external_url,
        }

    if item.subject_id and item.subject:
        data["subject"] = {
            "id": item.subject.id,
            "name": item.subject.name,
            "color": item.subject.color,
        }

    return data
