# api/app/routes/schedule.py
# Rotas do cronograma inteligente e adaptativo.
#
# v8.3 — Solução completa do problema:
#   - delete_schedule soft-deleta TODOS os items do schedule
#   - generate no engine agora ressuscita schedules deletados em vez de
#     tentar criar novos (evita violar UNIQUE constraint)
#   - Migration separada troca UNIQUE por partial unique index
#
# v8.1 — Serializer detecta prefixo [LONGA] em priority_reason e expõe
#        flag is_long_lesson para o frontend exibir badge.

from datetime import datetime, timezone, date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE
from sqlalchemy import func, case
from sqlalchemy.orm import joinedload

from app.extensions import db, limiter
from app.models.user import User, UserRole
from app.models.course import CourseEnrollment, Lesson, Subject
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn
from app.services.schedule_engine import ScheduleEngine, FORCE_FIT_PREFIX
from app.middleware.tenant import (
    resolve_tenant,
    require_tenant,
    get_current_tenant,
)

schedule_bp = Blueprint("schedule", __name__)


# ── Schemas ───────────────────────────────────────────────────────────────────


class GenerateScheduleSchema(Schema):
    course_id = fields.Str(required=True)
    target_date = fields.Str(allow_none=True, load_default=None)

    class Meta:
        unknown = EXCLUDE


class UpdateAvailabilitySchema(Schema):
    days = fields.List(fields.Int(validate=validate.Range(min=0, max=6)), required=True)
    hours_per_day = fields.Float(
        required=True, validate=validate.Range(min=0.5, max=12.0)
    )
    preferred_start_time = fields.Str(load_default="08:00")
    # v11: pausa entre atividades (0 = sem pausa, máx 15 min)
    break_minutes = fields.Int(
        load_default=0,
        validate=validate.Range(min=0, max=15),
    )
 
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
@limiter.limit("1000 per hour")
def generate_schedule():
    """
    Enfileira geração do cronograma via Celery e retorna task_id imediatamente.

    Response 202:
      { "status": "pending", "task_id": "...", "poll_url": "/api/v1/schedule/status/<task_id>" }

    Faça GET /schedule/status/<task_id> a cada 2s até status="ready".
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

    from app.tasks.schedule_tasks import generate_schedule_task

    task = generate_schedule_task.delay(
        user_id=str(user_id),
        tenant_id=str(tenant.id),
        course_id=str(course_id),
        target_date=target_date,
    )

    return (
        jsonify(
            {
                "status": "pending",
                "task_id": task.id,
                "poll_url": f"/api/v1/schedule/status/{task.id}",
            }
        ),
        202,
    )


@schedule_bp.route("/status/<string:task_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_schedule_status(task_id: str):
    """
    Polling de status para geração assíncrona do cronograma.

    Response:
      pending → { "status": "pending" }
      ready   → { "status": "ready", "message": "...", "schedule": {...}, "abandonment_risk": 0.1 }
      error   → { "status": "error", "message": "..." }
    """
    from app.tasks.schedule_tasks import get_task_status

    state = get_task_status(task_id)

    # Task ainda não foi pega pelo worker (fila cheia) ou key expirou
    if state is None:
        return jsonify({"status": "pending"}), 200

    if state["status"] == "error":
        return jsonify({"status": "error", "message": state.get("message", "Erro desconhecido")}), 500

    if state["status"] == "ready":
        schedule_id = state.get("schedule_id")
        if not schedule_id:
            return jsonify({"status": "error", "message": "schedule_id ausente no resultado"}), 500

        schedule = StudySchedule.query.filter_by(id=schedule_id, is_deleted=False).first()
        if not schedule:
            return jsonify({"status": "error", "message": "Cronograma não encontrado"}), 404

        response_data = {
            "status": "ready",
            "message": "Cronograma gerado com sucesso.",
            "schedule": _serialize_schedule(schedule),
            "abandonment_risk": state.get("abandonment_risk", 0),
        }
        if state.get("coverage_gap"):
            response_data["coverage_gap"] = state["coverage_gap"]

        return jsonify(response_data), 200

    # status == "pending"
    return jsonify({"status": "pending"}), 200


@schedule_bp.route("/", methods=["GET"])
@jwt_required()
@require_tenant
def get_schedule():
    """Retorna os itens do cronograma agrupados por dia."""
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

    items = (
        ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date >= today_str,
            ScheduleItem.scheduled_date <= end_str,
            ScheduleItem.is_deleted == False,
        )
        .options(
            joinedload(ScheduleItem.lesson),
            joinedload(ScheduleItem.subject),
        )
        .order_by(ScheduleItem.scheduled_date, ScheduleItem.order)
        .all()
    )

    s3_keys = set()
    for item in items:
        if item.lesson and item.lesson.video_s3_key:
            s3_keys.add(item.lesson.video_s3_key)

    presigned_urls = {}
    if s3_keys:
        try:
            from app.routes.uploads import generate_video_presigned_url

            for s3_key in s3_keys:
                presigned_urls[s3_key] = generate_video_presigned_url(s3_key)
        except Exception:
            pass

    avail_snap = schedule.availability_snapshot or {}
    snap_hours = avail_snap.get("hours_per_day") or 2
    effective_daily_minutes = int(snap_hours * 60)

    days_map = {}
    for item in items:
        d = item.scheduled_date
        if d not in days_map:
            days_map[d] = []
        days_map[d].append(
            _serialize_item(item, presigned_urls, effective_daily_minutes)
        )

    days_list = [
        {"date": d, "items": day_items} for d, day_items in sorted(days_map.items())
    ]

    pending_today = sum(
        1 for i in items if i.scheduled_date == today_str and i.status == "pending"
    )

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
        "break_minutes": avail_snap.get("break_minutes", 0),
    }
    snapshot = schedule.availability_snapshot or {}
    coverage_gap = snapshot.get("coverage_gap")

    response_data = {
        "schedule": _serialize_schedule(schedule),
        "days": days_list,
        "stats": stats,
    }
    if coverage_gap:
        response_data["coverage_gap"] = coverage_gap

    return jsonify(response_data), 200


# ══════════════════════════════════════════════════════════════════════════════
# CHECK-IN
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/checkin/<string:item_id>", methods=["POST"])
@jwt_required()
@require_tenant
def checkin_item(item_id: str):
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

    checkin = ScheduleCheckIn.query.filter_by(item_id=item_id).first()
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
        checkin.is_deleted = False
        checkin.completed = data["completed"]
        checkin.note = data.get("note", checkin.note)
        checkin.perceived_difficulty = data.get(
            "perceived_difficulty", checkin.perceived_difficulty
        )
        checkin.checked_in_at = now_iso

    item.status = "done" if data["completed"] else "skipped"

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

    try:
        from app.routes.analytics import _cache_delete, _dashboard_cache_key

        _cache_delete(_dashboard_cache_key(user_id, tenant.id))
        _cache_delete(f"next_action:{tenant.id}:{user_id}")
    except Exception:
        pass

    try:
        from app.tasks.schedule_tasks import adapt_after_checkin

        adapt_after_checkin.delay(
            user_id=user_id,
            tenant_id=tenant.id,
            course_id=schedule.course_id,
            item_id=item_id,
        )
    except Exception:
        pass

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


@schedule_bp.route("/checkin/<string:item_id>", methods=["DELETE"])
@jwt_required()
@require_tenant
def uncheckin_item(item_id: str):
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    item = ScheduleItem.query.filter_by(id=item_id, is_deleted=False).first()
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

    item.status = "pending"

    checkin = ScheduleCheckIn.query.filter_by(item_id=item_id, is_deleted=False).first()
    if checkin:
        checkin.is_deleted = True

    if item.item_type == "lesson" and item.lesson_id:
        from app.models.course import LessonProgress

        progress = LessonProgress.query.filter_by(
            lesson_id=item.lesson_id,
            user_id=user_id,
            tenant_id=tenant.id,
        ).first()
        if progress:
            progress.status = "not_watched"
            progress.watch_percentage = 0.0
            progress.last_watched_at = None

    db.session.commit()

    try:
        from app.routes.analytics import _cache_delete, _dashboard_cache_key

        _cache_delete(_dashboard_cache_key(user_id, tenant.id))
        _cache_delete(f"next_action:{tenant.id}:{user_id}")
    except Exception:
        pass

    return jsonify({"message": "Check-in desfeito.", "item_status": "pending"}), 200


# ══════════════════════════════════════════════════════════════════════════════
# REORGANIZAÇÃO / DELETE / AVAILABILITY
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/reorganize", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("100 per hour")
def reorganize_schedule():
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
    """
    Remove cronograma do aluno (soft delete).

    v8.2/8.3: Também soft-deleta TODOS os items do schedule.
    O generate() subsequente vai RESSUSCITAR este schedule deletado
    (em vez de tentar criar novo e violar o UNIQUE constraint),
    garantindo um cronograma limpo.
    """
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

    now_iso = datetime.now(timezone.utc).isoformat()
    items_deleted = ScheduleItem.query.filter_by(
        schedule_id=schedule.id,
        is_deleted=False,
    ).update(
        {
            "is_deleted": True,
            "deleted_at": now_iso,
        },
        synchronize_session=False,
    )

    schedule.soft_delete()
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Cronograma removido.",
                "items_deleted": items_deleted,
            }
        ),
        200,
    )



@schedule_bp.route("/availability", methods=["PUT"])
@jwt_required()
@require_tenant
def update_availability():
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
        "break_minutes": data.get("break_minutes", 0),  # v11
    }
    db.session.commit()
 
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
    snapshot = schedule.availability_snapshot or {}
    return {
        "id": schedule.id,
        "course_id": schedule.course_id,
        "status": schedule.status,
        "source_type": schedule.source_type or "ai",
        "target_date": schedule.target_date,
        "abandonment_risk": schedule.abandonment_risk_score,
        "ai_notes": schedule.ai_notes,
        "last_reorganized_at": schedule.last_reorganized_at,
        "hours_per_day": snapshot.get("hours_per_day"),
        "days": snapshot.get("days"),
        "break_minutes": snapshot.get("break_minutes", 0),  # v11
    }

def _serialize_item(
    item: ScheduleItem,
    presigned_urls: dict = None,
    effective_daily_minutes: int = None,
) -> dict:
    """
    Serializa um item do cronograma.

    v8.1: Detecta prefixo [LONGA] em priority_reason e expõe como
    is_long_lesson=True, removendo o prefixo da mensagem visível.
    Fallback: também detecta por estimated_minutes > effective_daily_minutes
    (cobre cronogramas antigos gerados antes da v8.1).
    """
    presigned_urls = presigned_urls or {}

    raw_reason = item.priority_reason or ""
    is_long_lesson = False
    priority_reason = raw_reason

    if raw_reason.startswith(FORCE_FIT_PREFIX):
        is_long_lesson = True
        priority_reason = raw_reason[len(FORCE_FIT_PREFIX):].lstrip()
    elif (
        item.item_type == "lesson"
        and effective_daily_minutes
        and item.estimated_minutes > effective_daily_minutes
    ):
        is_long_lesson = True

    data = {
        "id": item.id,
        "item_type": item.item_type,
        "status": item.status,
        "scheduled_date": item.scheduled_date,
        "order": item.order,
        "estimated_minutes": item.estimated_minutes,
        "priority_reason": priority_reason,
        "is_long_lesson": is_long_lesson,
        "has_checkin": item.checkin is not None,
        "question_filters": item.question_filters,
        "template_item_title": item.template_item_title,
        "template_item_notes": item.template_item_notes,
    }

    if item.lesson_id and item.lesson:
        lesson = item.lesson
        video_url = None

        if lesson.video_s3_key:
            video_url = presigned_urls.get(lesson.video_s3_key)
            if not video_url:
                try:
                    from app.routes.uploads import generate_video_presigned_url
                    video_url = generate_video_presigned_url(lesson.video_s3_key)
                except Exception:
                    video_url = None
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