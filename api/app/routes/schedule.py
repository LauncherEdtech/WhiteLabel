# api/app/routes/schedule.py
# FIX 2.2 — get_schedule: cache de presigned URLs no Redis (TTL 1h)
# FIX 2.4 — reorganize_schedule: movido para Celery assíncrono com polling
#
# Rotas do cronograma inteligente e adaptativo.

from datetime import datetime, timezone, date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE
from sqlalchemy import func, case
from sqlalchemy.orm import joinedload

from app.extensions import db, limiter, redis_client
from app.models.user import User, UserRole
from app.models.course import CourseEnrollment, Lesson, Subject
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn
from app.services.schedule_engine import ScheduleEngine, FORCE_FIT_PREFIX
from app.middleware.tenant import (
    resolve_tenant,
    require_tenant,
    get_current_tenant,
)
from app.tasks.schedule_tasks import generate_schedule_task, get_task_status

schedule_bp = Blueprint("schedule", __name__)

# ── TTL do cache de presigned URLs (1h — mesmo TTL padrão da AWS) ─────────────
_PRESIGNED_URL_CACHE_TTL = 3300  # 55 min (margem de 5 min antes de expirar)


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


# ── Helper: presigned URL com cache Redis ─────────────────────────────────────

def _get_presigned_url_cached(s3_key: str) -> str | None:
    """
    FIX 2.2: gera presigned URL com cache no Redis (TTL 55 min).

    ANTES: get_schedule() chamava generate_video_presigned_url() para cada
    lesson com video_s3_key em um loop — N chamadas HTTP à AWS por request.

    DEPOIS: primeira chamada gera e cacheia. Calls subsequentes retornam
    do Redis em < 1ms. Invalida automaticamente 5 min antes de expirar.
    """
    cache_key = f"presigned_url:{s3_key}"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return cached
    except Exception:
        pass

    try:
        from app.routes.uploads import generate_video_presigned_url
        url = generate_video_presigned_url(s3_key)
        if url:
            try:
                redis_client.setex(cache_key, _PRESIGNED_URL_CACHE_TTL, url)
            except Exception:
                pass
        return url
    except Exception:
        return None


# ══════════════════════════════════════════════════════════════════════════════
# GERAR / OBTER CRONOGRAMA
# ══════════════════════════════════════════════════════════════════════════════


@schedule_bp.route("/generate", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("1000 per hour")
def generate_schedule():
    """
    Enfileira geração do cronograma via Celery.
    Retorna imediatamente com task_id para polling.
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
            jsonify({"error": "not_enrolled", "message": "Você não está matriculado neste curso."}),
            403,
        )

    task = generate_schedule_task.delay(
        user_id=str(user_id),
        tenant_id=str(tenant.id),
        course_id=str(course_id),
        target_date=target_date,
    )

    return (
        jsonify({
            "status": "pending",
            "task_id": task.id,
            "poll_url": f"/api/v1/schedule/status/{task.id}",
        }),
        202,
    )


@schedule_bp.route("/status/<string:task_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_schedule_status(task_id: str):
    """Polling de status para geração assíncrona do cronograma."""
    state = get_task_status(task_id)

    if state is None:
        return jsonify({"status": "pending"}), 200

    if state["status"] == "error":
        return jsonify({"status": "error", "message": state.get("message", "Erro desconhecido")}), 500

    if state["status"] == "ready":
        schedule_id = state.get("schedule_id")
        if not schedule_id:
            return jsonify({"status": "error", "message": "schedule_id ausente"}), 500

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

        try:
            from app.routes.analytics import _cache_delete, _dashboard_cache_key
            _cache_delete(_dashboard_cache_key(schedule.user_id, schedule.tenant_id))
            _cache_delete(f"next_action:{schedule.tenant_id}:{schedule.user_id}")
        except Exception:
            pass

        return jsonify(response_data), 200

    return jsonify({"status": "pending"}), 200


@schedule_bp.route("/", methods=["GET"])
@jwt_required()
@require_tenant
def get_schedule():
    """
    Retorna os itens do cronograma agrupados por dia.

    FIX 2.2: presigned URLs agora usam cache Redis (TTL 55 min).
    ANTES: N chamadas HTTP à AWS por request → latência P50 16s.
    DEPOIS: cache hit em < 1ms por URL → P50 esperado < 2s.
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
            joinedload(ScheduleItem.checkin),
        )
        .order_by(ScheduleItem.scheduled_date, ScheduleItem.order)
        .all()
    )

    # FIX 2.2: coleta s3_keys únicas e resolve URLs com cache
    # ANTES: loop gerando 1 presigned URL por lesson (N calls HTTP)
    # DEPOIS: _get_presigned_url_cached() retorna do Redis em < 1ms após 1ª chamada
    s3_keys = set()
    for item in items:
        if item.lesson and item.lesson.video_s3_key:
            s3_keys.add(item.lesson.video_s3_key)

    presigned_urls = {}
    for s3_key in s3_keys:
        url = _get_presigned_url_cached(s3_key)
        if url:
            presigned_urls[s3_key] = url

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
        checkin.perceived_difficulty = data.get("perceived_difficulty", checkin.perceived_difficulty)
        checkin.checked_in_at = now_iso

    item.status = "done" if data["completed"] else "skipped"

    if item.item_type == "lesson" and item.lesson_id:
        from app.models.course import LessonProgress

        progress = LessonProgress.query.filter_by(
            lesson_id=item.lesson_id, user_id=user_id, tenant_id=tenant.id,
        ).first()
        if not progress:
            progress = LessonProgress(
                tenant_id=tenant.id, lesson_id=item.lesson_id, user_id=user_id,
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
        jsonify({
            "message": "Check-in registrado.",
            "item_status": item.status,
            "completed": data["completed"],
        }),
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
            lesson_id=item.lesson_id, user_id=user_id, tenant_id=tenant.id,
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
    """
    FIX 2.4 — Reorganização movida para Celery assíncrono.

    ANTES: ScheduleEngine.reorganize() rodava síncrono no request HTTP.
           P50=12s, P95=27s — tela travada esperando.

    DEPOIS: dispara task Celery e retorna imediatamente com task_id.
            Frontend faz polling em GET /schedule/status/<task_id> (igual
            ao generate_schedule que já funciona assim).

    Response 202: { "status": "pending", "task_id": "...", "poll_url": "..." }
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    course_id = (request.get_json(force=True) or {}).get("course_id")
    if not course_id:
        return jsonify({"error": "course_id obrigatório"}), 400

    # Verifica se o cronograma existe antes de disparar a task
    schedule = StudySchedule.query.filter_by(
        user_id=user_id,
        course_id=course_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not schedule:
        return jsonify({"error": "not_found", "message": "Cronograma não encontrado."}), 404

    # Reutiliza generate_schedule_task — ela já chama reorganize() internamente
    # quando o cronograma existe (ver ScheduleEngine.generate() → reorganize())
    task = generate_schedule_task.delay(
        user_id=str(user_id),
        tenant_id=str(tenant.id),
        course_id=str(course_id),
    )

    return (
        jsonify({
            "status": "pending",
            "task_id": task.id,
            "poll_url": f"/api/v1/schedule/status/{task.id}",
            "message": "Reorganização iniciada. Acompanhe em poll_url.",
        }),
        202,
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

    now_iso = datetime.now(timezone.utc).isoformat()
    items_deleted = ScheduleItem.query.filter_by(
        schedule_id=schedule.id,
        is_deleted=False,
    ).update(
        {"is_deleted": True, "deleted_at": now_iso},
        synchronize_session=False,
    )

    schedule.soft_delete()
    db.session.commit()

    try:
        from app.routes.analytics import _cache_delete, _dashboard_cache_key
        _cache_delete(_dashboard_cache_key(user_id, tenant.id))
        _cache_delete(f"next_action:{tenant.id}:{user_id}")
    except Exception:
        pass

    return (
        jsonify({"message": "Cronograma removido.", "items_deleted": items_deleted}),
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
        "break_minutes": data.get("break_minutes", 0),
    }
    db.session.commit()

    # Reorganiza cronogramas ativos via Celery (não síncrono)
    schedules = StudySchedule.query.filter_by(
        user_id=user_id,
        tenant_id=tenant.id,
        status="active",
        is_deleted=False,
    ).all()

    task_ids = []
    for schedule in schedules:
        try:
            task = generate_schedule_task.delay(
                user_id=str(user_id),
                tenant_id=str(tenant.id),
                course_id=str(schedule.course_id),
            )
            task_ids.append(task.id)
        except Exception:
            pass

    return (
        jsonify({
            "message": f"Disponibilidade atualizada. {len(task_ids)} cronograma(s) sendo reorganizado(s).",
            "availability": user.study_availability,
            "reorganize_task_ids": task_ids,
        }),
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
        "break_minutes": snapshot.get("break_minutes", 0),
    }


def _serialize_item(
    item: ScheduleItem,
    presigned_urls: dict = None,
    effective_daily_minutes: int = None,
) -> dict:
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
            # FIX 2.2: usa cache Redis — não faz chamada HTTP à AWS aqui
            video_url = presigned_urls.get(lesson.video_s3_key)
            if not video_url:
                video_url = _get_presigned_url_cached(lesson.video_s3_key)
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