# api/app/routes/analytics.py
# Dashboard do aluno + Analytics do produtor + Insights automáticos via Gemini.
# SEGURANÇA: Todas as queries filtram por tenant_id.
# Aluno só vê seus próprios dados. Produtor vê dados da turma.
#
# OTIMIZAÇÕES (v3):
#   1. _get_questions_stats        → 1 query SQL com CASE WHEN
#   2. _get_discipline_stats       → 1 query JOIN + GROUP BY
#   3. _get_time_stats             → joinedload elimina N+1; SUM/CASE no banco
#   4. _get_lesson_progress_stats  → COUNT + CASE WHEN; subquery corrigida
#   5. student_dashboard           → cache Redis 1h
#   6. _get_lesson_stats_for_tenant → REESCRITO: era N+1 (2 queries/aula), agora 3 queries totais
#   7. _get_at_risk_students       → REESCRITO: era 5+ queries/aluno, agora 3 queries totais
#   8. _get_student_quick_stats    → REESCRITO: era 4 queries/aluno, agora batch único
#   9. _get_student_rankings       → REESCRITO: usa batch stats, sem loop de queries
#  10. _get_class_discipline_stats → REESCRITO: era .all() + lazy load, agora JOIN + GROUP BY
#
# MENTOR INTELIGENTE (v4 — invalidação por evento):
#  - next_action TTL: 15min → 4h (14400s)
#  - Invalidação por evento: resposta de questão, checkin/uncheckin de aula/item
#  - _maybe_invalidate_insights(): invalida insights apenas quando disciplina muda de faixa

import json
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy import func, and_, case, select
from sqlalchemy.orm import joinedload

from app.extensions import db, limiter
from app.models.user import User, UserRole
from app.models.course import (
    Course,
    Subject,
    Module,
    Lesson,
    LessonProgress,
    CourseEnrollment,
)
from app.models.question import Question, QuestionAttempt
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn
from app.middleware.tenant import (
    resolve_tenant,
    require_tenant,
    require_feature,
    get_current_tenant,
)

BRT = timezone(timedelta(hours=-3))

analytics_bp = Blueprint("analytics", __name__)


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS DE CACHE REDIS
# ══════════════════════════════════════════════════════════════════════════════


def _cache_get(key: str):
    try:
        from app.extensions import redis_client
        raw = redis_client.get(key)
        if raw:
            current_app.logger.debug(f"[CACHE HIT] {key}")
            return json.loads(raw)
        current_app.logger.debug(f"[CACHE MISS] {key}")
        return None
    except Exception as e:
        current_app.logger.warning(f"[CACHE ERROR] Redis get falhou: {e}")
        return None


def _cache_set(key: str, value, ttl_seconds: int = 180):
    try:
        from app.extensions import redis_client
        redis_client.setex(key, ttl_seconds, json.dumps(value, default=str))
        current_app.logger.debug(f"[CACHE SET] {key} TTL={ttl_seconds}s")
    except Exception as e:
        current_app.logger.warning(f"[CACHE ERROR] Redis set falhou: {e}")


def _cache_delete(key: str):
    try:
        from app.extensions import redis_client
        redis_client.delete(key)
    except Exception:
        pass


def _dashboard_cache_key(user_id: str, tenant_id: str) -> str:
    return f"analytics:dashboard:{tenant_id}:{user_id}"


def _insights_cache_key(user_id: str, tenant_id: str) -> str:
    return f"analytics:insights:{tenant_id}:{user_id}"


def _get_cached_insights(user_id: str, tenant_id: str):
    return _cache_get(_insights_cache_key(user_id, tenant_id))


def _set_cached_insights(user_id: str, tenant_id: str, insights: list):
    _cache_set(_insights_cache_key(user_id, tenant_id), insights, ttl_seconds=43200)


def _delete_cached_insights(user_id: str, tenant_id: str):
    _cache_delete(_insights_cache_key(user_id, tenant_id))


def _maybe_invalidate_insights(user_id: str, tenant_id: str, discipline: str) -> None:
    """
    Invalida o cache de insights apenas se o desempenho na disciplina
    mudou de faixa de performance:
      crítico  → accuracy < 40%
      fraco    → 40% ≤ accuracy < 70%
      forte    → accuracy ≥ 70%

    Estratégia: compara a faixa atual com a última faixa salva no Redis.
    Só chama _delete_cached_insights quando a faixa efetivamente mudou,
    evitando regeneração desnecessária do Gemini a cada questão respondida.

    Requisito mínimo: 5 tentativas na disciplina para detectar mudança confiável.
    """
    if not discipline:
        return
    try:
        from app.extensions import redis_client

        recent = (
            db.session.query(QuestionAttempt.is_correct)
            .join(Question, Question.id == QuestionAttempt.question_id)
            .filter(
                QuestionAttempt.user_id == user_id,
                QuestionAttempt.tenant_id == tenant_id,
                Question.discipline == discipline,
                QuestionAttempt.is_deleted == False,
            )
            .order_by(QuestionAttempt.created_at.desc())
            .limit(20)
            .all()
        )

        if len(recent) < 5:
            return  # dados insuficientes para detectar mudança de faixa

        accuracy = sum(1 for r in recent if r.is_correct) / len(recent) * 100
        faixa_atual = "critico" if accuracy < 40 else "fraco" if accuracy < 70 else "forte"

        # Chave de faixa por disciplina — TTL de 24h (reset diário)
        faixa_key = f"insight_faixa:{tenant_id}:{user_id}:{discipline}"
        faixa_anterior_raw = redis_client.get(faixa_key)
        faixa_anterior = faixa_anterior_raw.decode() if faixa_anterior_raw else None

        redis_client.setex(faixa_key, 86400, faixa_atual)

        if faixa_anterior and faixa_anterior != faixa_atual:
            _delete_cached_insights(user_id, tenant_id)
            current_app.logger.info(
                f"[INSIGHTS] Invalidado — {discipline} mudou {faixa_anterior}→{faixa_atual} "
                f"user={user_id}"
            )
    except Exception as e:
        current_app.logger.debug(
            f"[INSIGHTS] _maybe_invalidate_insights falhou silenciosamente: {e}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS DE AUTORIZAÇÃO
# ══════════════════════════════════════════════════════════════════════════════


def _is_producer_or_above(claims: dict) -> bool:
    return claims.get("role") in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    )


def _is_student(claims: dict) -> bool:
    return claims.get("role") == UserRole.STUDENT.value


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS DE AULAS (produtor)
# OTIMIZAÇÃO v3: era N+1 (2 queries por aula × 617 aulas = 1234 queries).
# Agora usa 3 queries totais com GROUP BY.
# ══════════════════════════════════════════════════════════════════════════════


def _get_lesson_stats_for_tenant(tenant_id: str, course_id: str = None) -> dict:
    courses_query = Course.query.filter_by(
        tenant_id=tenant_id,
        is_active=True,
        is_deleted=False,
    )
    if course_id:
        courses_query = courses_query.filter_by(id=course_id)
    courses = courses_query.all()

    if not courses:
        return {
            "total_lessons": 0,
            "total_watched_sum": 0,
            "courses": [],
            "top_watched_lessons": [],
            "low_watched_lessons": [],
        }

    course_ids = [c.id for c in courses]

    # ── Query 1: contagem de matriculados por curso (1 query) ─────────────────
    enrolled_rows = (
        db.session.query(
            CourseEnrollment.course_id,
            func.count(CourseEnrollment.id).label("enrolled_count"),
        )
        .filter(
            CourseEnrollment.course_id.in_(course_ids),
            CourseEnrollment.tenant_id == tenant_id,
            CourseEnrollment.is_active == True,
            CourseEnrollment.is_deleted == False,
        )
        .group_by(CourseEnrollment.course_id)
        .all()
    )
    enrolled_by_course = {str(r.course_id): r.enrolled_count for r in enrolled_rows}

    # ── Query 2: watched count por lesson (1 query) ───────────────────────────
    watched_rows = (
        db.session.query(
            LessonProgress.lesson_id,
            func.count(LessonProgress.id).label("watched_count"),
        )
        .filter(
            LessonProgress.tenant_id == tenant_id,
            LessonProgress.status == "watched",
            LessonProgress.is_deleted == False,
        )
        .group_by(LessonProgress.lesson_id)
        .all()
    )
    watched_by_lesson = {str(r.lesson_id): r.watched_count for r in watched_rows}

    # ── Monta stats iterando nos objetos já carregados (sem queries adicionais) ─
    total_lessons_platform = 0
    total_watched_platform = 0
    courses_stats = []
    all_lesson_stats = []

    for course in courses:
        course_lessons = 0
        course_watched = 0
        course_lesson_rows = []
        enrolled = enrolled_by_course.get(str(course.id), 0)

        for subject in course.subjects:
            if subject.is_deleted:
                continue
            for module in subject.modules:
                if module.is_deleted:
                    continue
                for lesson in module.lessons:
                    if lesson.is_deleted or not lesson.is_published:
                        continue

                    watched_count = watched_by_lesson.get(str(lesson.id), 0)
                    completion_pct = (
                        round((watched_count / enrolled) * 100, 1) if enrolled else 0.0
                    )

                    row = {
                        "lesson_id": lesson.id,
                        "lesson_title": lesson.title,
                        "module_name": module.name,
                        "subject_name": subject.name,
                        "subject_color": subject.color,
                        "course_id": course.id,
                        "course_name": course.name,
                        "duration_min": lesson.duration_minutes,
                        "watched_count": watched_count,
                        "enrolled_count": enrolled,
                        "completion_pct": completion_pct,
                    }
                    course_lesson_rows.append(row)
                    all_lesson_stats.append(row)
                    course_lessons += 1
                    course_watched += watched_count

        avg_completion = (
            round(
                sum(r["completion_pct"] for r in course_lesson_rows)
                / len(course_lesson_rows),
                1,
            )
            if course_lesson_rows
            else 0.0
        )

        courses_stats.append(
            {
                "course_id": course.id,
                "course_name": course.name,
                "total_lessons": course_lessons,
                "enrolled_count": enrolled,
                "avg_completion": avg_completion,
                "lessons": sorted(
                    course_lesson_rows, key=lambda x: x["completion_pct"], reverse=True
                ),
            }
        )

        total_lessons_platform += course_lessons
        total_watched_platform += course_watched

    eligible = [r for r in all_lesson_stats if r["enrolled_count"] > 0]
    top_watched = sorted(
        [r for r in eligible if r["watched_count"] > 0],
        key=lambda x: x["completion_pct"],
        reverse=True,
    )[:5]
    low_watched = sorted(eligible, key=lambda x: x["completion_pct"])[:5]

    return {
        "total_lessons": total_lessons_platform,
        "total_watched_sum": total_watched_platform,
        "courses": courses_stats,
        "top_watched_lessons": top_watched,
        "low_watched_lessons": low_watched,
    }


@analytics_bp.before_request
def before_request():
    resolve_tenant()


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD DO ALUNO  —  com cache Redis 1h
# ══════════════════════════════════════════════════════════════════════════════


@analytics_bp.route("/student/dashboard", methods=["GET"])
@jwt_required()
@require_tenant
def student_dashboard():
    tenant = get_current_tenant()
    user_id = get_jwt_identity()
    claims = get_jwt()

    if _is_producer_or_above(claims):
        target_user_id = request.args.get("user_id", user_id)
        target_user = User.query.filter_by(
            id=target_user_id,
            tenant_id=tenant.id,
            is_deleted=False,
        ).first()
        if not target_user:
            return jsonify({"error": "user_not_found"}), 404
    else:
        target_user_id = user_id
        target_user = User.query.filter_by(
            id=user_id,
            is_deleted=False,
        ).first()

    if not _is_producer_or_above(claims):
        cache_key = _dashboard_cache_key(target_user_id, tenant.id)
        cached = _cache_get(cache_key)
        if cached:
            return jsonify(cached), 200

    now = datetime.now(timezone.utc)
    now_brt = now.astimezone(BRT)
    today_start = now_brt.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(
        timezone.utc
    )
    week_start = today_start - timedelta(days=now_brt.weekday())

    questions_stats = _get_questions_stats(target_user_id, tenant.id, today_start, week_start)
    discipline_stats = _get_discipline_stats(target_user_id, tenant.id)
    lesson_progress = _get_lesson_progress_stats(target_user_id, tenant.id)
    todays_pending = _get_todays_pending(target_user_id, tenant.id, today_start)
    time_stats = _get_time_stats(target_user_id, tenant.id, today_start, week_start)
    weekly_mission = _get_weekly_mission(target_user_id, tenant.id, discipline_stats)

    insights = _get_cached_insights(target_user_id, tenant.id)
    if not insights:
        insights = _generate_insights(
            user=target_user,
            tenant=tenant,
            questions_stats=questions_stats,
            discipline_stats=discipline_stats,
            lesson_progress=lesson_progress,
            weekly_mission=weekly_mission,
            todays_pending=todays_pending,
        )
        _set_cached_insights(target_user_id, tenant.id, insights)

    payload = {
        "student": {"id": target_user.id, "name": target_user.name},
        "questions": questions_stats,
        "discipline_performance": discipline_stats,
        "lesson_progress": lesson_progress,
        "time_studied": time_stats,
        "todays_pending": todays_pending,
        "weekly_mission": weekly_mission,
        "insights": insights,
        "generated_at": now.isoformat(),
    }

    if not _is_producer_or_above(claims):
        _cache_set(cache_key, payload, ttl_seconds=3600)

    return jsonify(payload), 200


def _get_weekly_mission(user_id: str, tenant_id: str, discipline_stats: list) -> dict:
    today = datetime.now(BRT).date()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    week_start_str = week_start.isoformat()
    week_end_str = week_end.isoformat()

    schedule = (
        StudySchedule.query.filter_by(user_id=user_id, tenant_id=tenant_id, is_deleted=False)
        .filter(StudySchedule.status == "active")
        .first()
    )

    has_schedule = schedule is not None
    items = []

    if has_schedule:
        week_items = (
            ScheduleItem.query.filter(
                ScheduleItem.schedule_id == schedule.id,
                ScheduleItem.scheduled_date >= week_start_str,
                ScheduleItem.scheduled_date <= week_end_str,
                ScheduleItem.is_deleted == False,
            )
            .order_by(ScheduleItem.scheduled_date, ScheduleItem.order)
            .all()
        )

        total = len(week_items)
        completed = sum(1 for i in week_items if i.status == "done")
        today_str = today.isoformat()
        pending = [
            i for i in week_items
            if i.status == "pending" and i.scheduled_date >= today_str
        ]

        if total > 0 and len(pending) > 0:
            pending_serialized = []
            for i in pending[:10]:
                d = {
                    "id": i.id,
                    "item_type": i.item_type,
                    "scheduled_date": i.scheduled_date,
                    "estimated_minutes": i.estimated_minutes,
                }
                if i.lesson_id and i.lesson:
                    d["lesson"] = {"id": i.lesson.id, "title": i.lesson.title}
                if i.subject_id and i.subject:
                    d["subject"] = {
                        "id": i.subject.id,
                        "name": i.subject.name,
                        "color": i.subject.color,
                    }
                pending_serialized.append(d)

            items.append({
                "type": "schedule",
                "title": "Seguir o cronograma da semana",
                "total": total,
                "completed": completed,
                "progress_pct": round((completed / total) * 100, 1) if total else 0,
                "done": completed >= total,
                "pending_items": pending_serialized,
            })

    discipline_alerts = []
    for disc in discipline_stats:
        accuracy = disc.get("accuracy_rate", 0)
        total_attempts = disc.get("total_answered") or disc.get("total_attempts", 0)
        if total_attempts < 5:
            continue
        if accuracy < 60:
            discipline_alerts.append({
                "discipline": disc["discipline"],
                "current_accuracy": accuracy,
                "target_accuracy": 60.0,
                "total_attempts": total_attempts,
                "urgent": accuracy < 40,
                "done": False,
            })

    if discipline_alerts:
        items.append({
            "type": "discipline_cluster",
            "title": "Melhore seu desempenho",
            "disciplines": discipline_alerts,
            "total": len(discipline_alerts),
            "done_count": 0,
            "done": False,
        })

    completed_items = sum(1 for i in items if i.get("done", False))

    return {
        "has_schedule": has_schedule,
        "schedule_source_type": (schedule.source_type if schedule else None),
        "week_start": week_start_str,
        "week_end": week_end_str,
        "items": items,
        "total_items": len(items),
        "completed_items": completed_items,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS DO PRODUTOR
# ══════════════════════════════════════════════════════════════════════════════


@analytics_bp.route("/producer/overview", methods=["GET"])
@jwt_required()
@require_tenant
def producer_overview():
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    course_id = request.args.get("course_id")

    students_query = User.query.filter_by(
        tenant_id=tenant.id,
        role=UserRole.STUDENT.value,
        is_active=True,
        is_deleted=False,
    )
    total_students = students_query.count()

    if total_students == 0:
        return jsonify({
            "overview": {
                "total_students": 0,
                "active_last_7_days": 0,
                "engagement_rate": 0.0,
                "at_risk_count": 0,
                "avg_accuracy": 0.0,
                "total_questions_answered": 0,
            },
            "at_risk_students": [],
            "class_discipline_performance": [],
            "hardest_questions": [],
            "student_rankings": {"top_performers": [], "needs_attention": []},
            "insights": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }), 200

    student_ids = [s.id for s in students_query.all()]
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    active_recently = (
        db.session.query(func.count(func.distinct(QuestionAttempt.user_id)))
        .filter(
            QuestionAttempt.tenant_id == tenant.id,
            QuestionAttempt.user_id.in_(student_ids),
            QuestionAttempt.is_deleted == False,
            QuestionAttempt.created_at >= week_ago,
        )
        .scalar() or 0
    )

    engagement_rate = round((active_recently / total_students) * 100, 1) if total_students else 0

    q_totals = (
        db.session.query(
            func.count(QuestionAttempt.id).label("total"),
            func.sum(case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
        )
        .filter(
            QuestionAttempt.tenant_id == tenant.id,
            QuestionAttempt.user_id.in_(student_ids),
            QuestionAttempt.is_deleted == False,
        )
        .one()
    )
    total_questions_answered = q_totals.total or 0
    avg_accuracy = (
        round((q_totals.correct / total_questions_answered) * 100, 1)
        if total_questions_answered else 0.0
    )

    at_risk = _get_at_risk_students(student_ids, tenant.id)
    class_discipline_stats = _get_class_discipline_stats(student_ids, tenant.id)
    hardest_questions = _get_hardest_questions(tenant.id)
    student_rankings = _get_student_rankings(student_ids, tenant.id)
    producer_insights = _generate_producer_insights(
        total_students=total_students,
        engagement_rate=engagement_rate,
        at_risk_count=len(at_risk),
        class_discipline_stats=class_discipline_stats,
    )
    lesson_stats = _get_lesson_stats_for_tenant(tenant.id)

    return jsonify({
        "overview": {
            "total_students": total_students,
            "active_last_7_days": active_recently,
            "engagement_rate": engagement_rate,
            "at_risk_count": len(at_risk),
            "avg_accuracy": avg_accuracy,
            "total_questions_answered": total_questions_answered,
        },
        "at_risk_students": at_risk[:10],
        "class_discipline_performance": class_discipline_stats,
        "hardest_questions": hardest_questions[:10],
        "student_rankings": student_rankings,
        "lesson_stats": lesson_stats,
        "insights": producer_insights,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }), 200


@analytics_bp.route("/producer/students", methods=["GET"])
@jwt_required()
@require_tenant
def producer_student_list():
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    search = request.args.get("search", "").strip()

    query = User.query.filter_by(
        tenant_id=tenant.id,
        role=UserRole.STUDENT.value,
        is_active=True,
        is_deleted=False,
    )
    if search:
        query = query.filter(
            User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )

    total = query.count()
    students = query.order_by(User.name).paginate(page=page, per_page=per_page, error_out=False)

    student_ids = [s.id for s in students.items]
    batch_stats = _get_batch_student_stats(student_ids, tenant.id)

    students_data = []
    for student in students.items:
        stats = batch_stats.get(str(student.id), {
            "total_answered": 0, "accuracy_rate": 0,
            "last_activity": None, "lessons_watched": 0, "is_at_risk": True,
        })
        students_data.append({
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "created_at": student.created_at.isoformat() if student.created_at else None,
            **stats,
        })

    return jsonify({
        "students": students_data,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": students.pages,
        },
    }), 200


# ══════════════════════════════════════════════════════════════════════════════
# CÁPSULA DE ESTUDOS
# ══════════════════════════════════════════════════════════════════════════════


@analytics_bp.route("/student/study-capsule", methods=["GET"])
@jwt_required()
@require_tenant
def student_study_capsule():
    from calendar import monthrange
    from app.models.gamification import StudentBadge
    from app.services.badge_engine import BADGES, RANKS

    tenant = get_current_tenant()
    user_id = get_jwt_identity()
    claims = get_jwt()

    target_user_id = request.args.get("user_id", user_id) if _is_producer_or_above(claims) else user_id

    user = User.query.filter_by(id=target_user_id, tenant_id=tenant.id, is_deleted=False).first()
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    now = datetime.now(timezone.utc)
    try:
        month = int(request.args.get("month", now.month))
        year = int(request.args.get("year", now.year))
    except ValueError:
        return jsonify({"error": "invalid_params"}), 400

    _, last_day = monthrange(year, month)
    period_start = datetime(year, month, 1, tzinfo=timezone.utc)
    period_end = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
    period_start_iso = period_start.isoformat()
    period_end_iso = period_end.isoformat()

    from app.models.simulado import SimuladoAttempt

    attempts = QuestionAttempt.query.filter(
        QuestionAttempt.user_id == target_user_id,
        QuestionAttempt.tenant_id == tenant.id,
        QuestionAttempt.is_deleted == False,
        QuestionAttempt.created_at >= period_start,
        QuestionAttempt.created_at <= period_end,
    ).all()

    questions_answered = len(attempts)
    questions_correct = sum(1 for a in attempts if a.is_correct)
    accuracy_rate = round((questions_correct / questions_answered) * 100, 1) if questions_answered else 0
    practice_attempts = [a for a in attempts if a.context != "simulado"]
    questions_seconds = sum(a.response_time_seconds or 0 for a in practice_attempts)

    lessons_watched_recs = LessonProgress.query.filter(
        LessonProgress.user_id == target_user_id,
        LessonProgress.tenant_id == tenant.id,
        LessonProgress.status == "watched",
        LessonProgress.is_deleted == False,
        LessonProgress.last_watched_at >= period_start_iso,
        LessonProgress.last_watched_at <= period_end_iso,
    ).all()

    lessons_watched = len(lessons_watched_recs)
    lessons_seconds = 0
    for prog in lessons_watched_recs:
        lesson = Lesson.query.get(prog.lesson_id)
        if lesson and lesson.duration_minutes:
            lessons_seconds += lesson.duration_minutes * 60

    simulados = SimuladoAttempt.query.filter(
        SimuladoAttempt.user_id == target_user_id,
        SimuladoAttempt.tenant_id == tenant.id,
        SimuladoAttempt.status.in_(["completed", "timed_out"]),
        SimuladoAttempt.total_time_seconds.isnot(None),
        SimuladoAttempt.finished_at >= period_start_iso,
        SimuladoAttempt.finished_at <= period_end_iso,
    ).all()
    simulado_seconds = sum(s.total_time_seconds or 0 for s in simulados)
    total_minutes = round((questions_seconds + lessons_seconds + simulado_seconds) / 60)

    by_disc = defaultdict(lambda: {"total": 0, "correct": 0})
    for attempt in attempts:
        q = attempt.question
        if not q:
            continue
        disc = q.discipline or "Sem disciplina"
        by_disc[disc]["total"] += 1
        if attempt.is_correct:
            by_disc[disc]["correct"] += 1

    disc_list = []
    for disc, s in by_disc.items():
        if s["total"] >= 3:
            acc = round((s["correct"] / s["total"]) * 100, 1)
            disc_list.append({"discipline": disc, "accuracy_rate": acc, "total": s["total"]})

    top_disciplines = sorted(disc_list, key=lambda x: x["accuracy_rate"], reverse=True)[:3]

    from app.services.badge_engine import BadgeEngine, get_rank, BADGES
    from app.models.gamification import StudentBadge as _StudentBadge

    _earned_points = sum(
        BADGES[b.badge_key]["points"]
        for b in _StudentBadge.query.filter_by(
            user_id=target_user_id, tenant_id=tenant.id, is_deleted=False
        ).all()
        if b.badge_key in BADGES
    )
    _gamification_theme = (tenant.settings or {}).get("gamification_theme", "militar")
    current_rank = get_rank(_earned_points, theme=_gamification_theme)

    period_badges = (
        StudentBadge.query.filter(
            StudentBadge.user_id == target_user_id,
            StudentBadge.tenant_id == tenant.id,
            StudentBadge.earned_at >= period_start_iso,
            StudentBadge.earned_at <= period_end_iso,
        )
        .order_by(StudentBadge.earned_at.desc())
        .first()
    )

    highlight_badge = None
    if period_badges:
        b = BADGES.get(period_badges.badge_key, {})
        highlight_badge = {
            "key": period_badges.badge_key,
            "name": b.get("name", period_badges.badge_key),
            "icon": b.get("icon", "🏆"),
        }

    active_days = set()
    for a in attempts:
        if a.created_at:
            active_days.add(a.created_at.date())
    streak_days = len(active_days)

    ai_phrase = _get_capsule_phrase(
        user=user, month=month, year=year, total_minutes=total_minutes,
        questions_answered=questions_answered, accuracy_rate=accuracy_rate,
        top_disciplines=top_disciplines, rank_name=current_rank.get("name", "Recruta"),
        tenant_id=tenant.id,
    )

    branding = tenant.branding or {}
    months_pt = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ]

    return jsonify({
        "period_label": f"{months_pt[month - 1]} {year}",
        "month": month, "year": year,
        "student_name": user.name,
        "rank": current_rank,
        "total_minutes": total_minutes,
        "questions_answered": questions_answered,
        "accuracy_rate": accuracy_rate,
        "lessons_watched": lessons_watched,
        "top_disciplines": top_disciplines,
        "highlight_badge": highlight_badge,
        "streak_days": streak_days,
        "ai_phrase": ai_phrase,
        "tenant_name": branding.get("platform_name", tenant.name),
        "tenant_logo_url": branding.get("logo_url"),
        "tenant_primary_color": branding.get("primary_color", "#6366f1"),
        "tenant_instagram": branding.get("instagram_handle"),
        "user_since": {"month": user.created_at.month, "year": user.created_at.year},
        "capsule_style": branding.get("capsule_style", "operativo"),
        "generated_at": now.isoformat(),
    }), 200


def _get_capsule_phrase(user, month, year, total_minutes, questions_answered,
                        accuracy_rate, top_disciplines, rank_name, tenant_id) -> str:
    cache_key = f"capsule_phrase:{tenant_id}:{user.id}:{year}:{month}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    phrase = _fallback_capsule_phrase(rank_name, total_minutes, questions_answered, accuracy_rate)

    api_key = current_app.config.get("GEMINI_API_KEY", "")
    if api_key:
        try:
            from google import genai
            top_disc_str = ", ".join(d["discipline"] for d in top_disciplines[:2]) or "sem dados"
            prompt = f"""Crie uma frase motivacional personalizada para um aluno de concursos públicos.
MÁXIMO 90 caracteres. Em português. Tom encorajador e direto.
Mencione a patente "{rank_name}" e pelo menos um dado real abaixo.

Dados do aluno em {month}/{year}:
- Minutos estudados: {total_minutes}
- Questões respondidas: {questions_answered}
- Taxa de acerto: {accuracy_rate}%
- Melhores disciplinas: {top_disc_str}
- Patente: {rank_name}

Responda APENAS com a frase, sem aspas, sem explicação."""

            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(model="gemini-2.5-flash-lite", contents=prompt)
            phrase = response.text.strip()[:100]
        except Exception as e:
            current_app.logger.warning(f"[GEMINI] Capsule phrase falhou: {e}")

    _cache_set(cache_key, phrase, ttl_seconds=86400)
    return phrase


def _fallback_capsule_phrase(rank_name, total_minutes, questions_answered, accuracy_rate) -> str:
    if accuracy_rate >= 75:
        return f"{rank_name}, você está em chamas! {accuracy_rate}% de acerto — continue assim rumo à aprovação."
    if total_minutes >= 2000:
        return f"{rank_name}, {total_minutes} minutos de estudo falam por si. Consistência é o caminho da aprovação."
    if questions_answered >= 300:
        return f"{rank_name}, {questions_answered} questões respondidas este mês. Cada uma te aproxima da aprovação!"
    return f"{rank_name}, cada minuto de estudo conta. Continue firme na missão!"


@analytics_bp.route("/producer/lessons", methods=["GET"])
@jwt_required()
@require_tenant
def producer_lesson_analytics():
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403
    tenant = get_current_tenant()
    course_id = request.args.get("course_id")
    stats = _get_lesson_stats_for_tenant(tenant.id, course_id)
    return jsonify(stats), 200


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS DE CÁLCULO — OTIMIZADOS
# ══════════════════════════════════════════════════════════════════════════════


def _get_questions_stats(user_id, tenant_id, today_start, week_start) -> dict:
    row = (
        db.session.query(
            func.count(QuestionAttempt.id).label("total"),
            func.sum(case((QuestionAttempt.is_correct == True, 1), else_=0)).label("total_correct"),
            func.sum(case((QuestionAttempt.created_at >= today_start, 1), else_=0)).label("today_total"),
            func.sum(case((and_(QuestionAttempt.created_at >= today_start, QuestionAttempt.is_correct == True), 1), else_=0)).label("today_correct"),
            func.sum(case((QuestionAttempt.created_at >= week_start, 1), else_=0)).label("week_total"),
            func.sum(case((and_(QuestionAttempt.created_at >= week_start, QuestionAttempt.is_correct == True), 1), else_=0)).label("week_correct"),
        )
        .filter(
            QuestionAttempt.user_id == user_id,
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.is_deleted == False,
        )
        .one()
    )

    total = row.total or 0
    total_correct = row.total_correct or 0
    today_total = row.today_total or 0
    today_correct = row.today_correct or 0
    week_total = row.week_total or 0
    week_correct = row.week_correct or 0

    return {
        "total_answered": total,
        "total_correct": total_correct,
        "overall_accuracy": round((total_correct / total) * 100, 1) if total else 0,
        "today": {
            "answered": today_total,
            "correct": today_correct,
            "accuracy": round((today_correct / today_total) * 100, 1) if today_total else 0,
        },
        "this_week": {
            "answered": week_total,
            "correct": week_correct,
            "accuracy": round((week_correct / week_total) * 100, 1) if week_total else 0,
        },
    }


def _get_discipline_stats(user_id, tenant_id) -> list:
    rows = (
        db.session.query(
            Question.discipline.label("discipline"),
            func.count(QuestionAttempt.id).label("total"),
            func.sum(case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
            func.sum(case((QuestionAttempt.is_correct == False, 1), else_=0)).label("wrong"),
            func.avg(QuestionAttempt.response_time_seconds).label("avg_time"),
        )
        .join(Question, QuestionAttempt.question_id == Question.id)
        .filter(
            QuestionAttempt.user_id == user_id,
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.is_deleted == False,
        )
        .group_by(Question.discipline)
        .all()
    )

    result = []
    for row in rows:
        disc = row.discipline or "Sem disciplina"
        total = row.total or 0
        correct = row.correct or 0
        accuracy = round((correct / total) * 100, 1) if total else 0
        result.append({
            "discipline": disc,
            "total_answered": total,
            "correct": correct,
            "wrong": row.wrong or 0,
            "accuracy_rate": accuracy,
            "avg_response_time_seconds": round(float(row.avg_time), 1) if row.avg_time else 0,
            "performance_label": _performance_label(accuracy),
        })

    return sorted(result, key=lambda x: x["accuracy_rate"])


def _performance_label(accuracy: float) -> str:
    if accuracy >= 70:
        return "forte"
    elif accuracy >= 50:
        return "regular"
    else:
        return "fraco"


def _get_lesson_progress_stats(user_id, tenant_id) -> dict:
    row = (
        db.session.query(
            func.sum(case((LessonProgress.status == "watched", 1), else_=0)).label("watched"),
            func.sum(case((LessonProgress.status == "not_watched", 1), else_=0)).label("not_watched"),
            func.sum(case((LessonProgress.status == "partial", 1), else_=0)).label("partial"),
        )
        .filter(
            LessonProgress.user_id == user_id,
            LessonProgress.tenant_id == tenant_id,
            LessonProgress.is_deleted == False,
        )
        .one()
    )

    total_watched = row.watched or 0
    total_not_watched = row.not_watched or 0
    total_partial = row.partial or 0

    enrollments = (
        CourseEnrollment.query.filter_by(
            user_id=user_id, tenant_id=tenant_id, is_active=True, is_deleted=False,
        )
        .with_entities(CourseEnrollment.course_id)
        .all()
    )

    course_ids = [e.course_id for e in enrollments]
    total_available = 0

    if course_ids:
        subject_ids_sq = (
            db.session.query(Subject.id)
            .filter(
                Subject.course_id.in_(course_ids),
                Subject.tenant_id == tenant_id,
                Subject.is_deleted == False,
            )
            .subquery()
        )
        module_ids_sq = (
            db.session.query(Module.id)
            .filter(
                Module.subject_id.in_(select(subject_ids_sq)),
                Module.is_deleted == False,
            )
            .subquery()
        )
        total_available = (
            db.session.query(func.count(Lesson.id))
            .filter(
                Lesson.module_id.in_(select(module_ids_sq)),
                Lesson.is_published == True,
                Lesson.tenant_id == tenant_id,
                Lesson.is_deleted == False,
            )
            .scalar() or 0
        )

    completion_rate = round((total_watched / total_available) * 100, 1) if total_available else 0

    return {
        "total_watched": total_watched,
        "total_not_watched": total_not_watched,
        "total_partial": total_partial,
        "total_available": total_available,
        "completion_rate": completion_rate,
    }


def _get_time_stats(user_id, tenant_id, today_start, week_start) -> dict:
    from app.models.simulado import SimuladoAttempt

    today_iso = today_start.isoformat()
    week_iso = week_start.isoformat()

    q_row = (
        db.session.query(
            func.sum(case((and_(QuestionAttempt.created_at >= today_start, QuestionAttempt.response_time_seconds.isnot(None)), QuestionAttempt.response_time_seconds), else_=0)).label("today_secs"),
            func.sum(case((and_(QuestionAttempt.created_at >= week_start, QuestionAttempt.response_time_seconds.isnot(None)), QuestionAttempt.response_time_seconds), else_=0)).label("week_secs"),
        )
        .filter(
            QuestionAttempt.user_id == user_id,
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.is_deleted == False,
            QuestionAttempt.context != "simulado",
        )
        .one()
    )

    questions_time_today = int(q_row.today_secs or 0)
    questions_time_week = int(q_row.week_secs or 0)

    lessons_today = (
        LessonProgress.query.options(joinedload(LessonProgress.lesson))
        .filter(
            LessonProgress.user_id == user_id,
            LessonProgress.tenant_id == tenant_id,
            LessonProgress.status == "watched",
            LessonProgress.is_deleted == False,
            LessonProgress.last_watched_at >= today_iso,
        ).all()
    )
    lessons_week = (
        LessonProgress.query.options(joinedload(LessonProgress.lesson))
        .filter(
            LessonProgress.user_id == user_id,
            LessonProgress.tenant_id == tenant_id,
            LessonProgress.status == "watched",
            LessonProgress.is_deleted == False,
            LessonProgress.last_watched_at >= week_iso,
        ).all()
    )

    lessons_time_today = sum((p.lesson.duration_minutes or 0) * 60 for p in lessons_today if p.lesson)
    lessons_time_week = sum((p.lesson.duration_minutes or 0) * 60 for p in lessons_week if p.lesson)

    sim_row = (
        db.session.query(
            func.sum(case((SimuladoAttempt.finished_at >= today_iso, SimuladoAttempt.total_time_seconds), else_=0)).label("today_secs"),
            func.sum(case((SimuladoAttempt.finished_at >= week_iso, SimuladoAttempt.total_time_seconds), else_=0)).label("week_secs"),
        )
        .filter(
            SimuladoAttempt.user_id == user_id,
            SimuladoAttempt.tenant_id == tenant_id,
            SimuladoAttempt.status.in_(["completed", "timed_out"]),
            SimuladoAttempt.total_time_seconds.isnot(None),
        )
        .one()
    )

    simulado_time_today = int(sim_row.today_secs or 0)
    simulado_time_week = int(sim_row.week_secs or 0)

    total_today_seconds = questions_time_today + lessons_time_today + simulado_time_today
    total_week_seconds = questions_time_week + lessons_time_week + simulado_time_week

    user = User.query.get(user_id)
    weekly_goal_hours = 0
    if user and user.study_availability:
        days_per_week = len(user.study_availability.get("days", []))
        hours_per_day = user.study_availability.get("hours_per_day", 2)
        weekly_goal_hours = days_per_week * hours_per_day

    weekly_goal_seconds = weekly_goal_hours * 3600
    weekly_progress_pct = round((total_week_seconds / weekly_goal_seconds) * 100, 1) if weekly_goal_seconds else 0

    return {
        "today_minutes": round(total_today_seconds / 60, 1),
        "week_minutes": round(total_week_seconds / 60, 1),
        "weekly_goal_hours": weekly_goal_hours,
        "weekly_goal_minutes": weekly_goal_hours * 60,
        "weekly_progress_percent": min(weekly_progress_pct, 100),
        "breakdown": {
            "today": {"questions_seconds": questions_time_today, "lessons_seconds": lessons_time_today, "simulados_seconds": simulado_time_today},
            "week": {"questions_seconds": questions_time_week, "lessons_seconds": lessons_time_week, "simulados_seconds": simulado_time_week},
        },
    }


def _get_todays_pending(user_id, tenant_id, today_start) -> list:
    today_str = today_start.astimezone(BRT).date().isoformat()
    items = (
        ScheduleItem.query.join(StudySchedule)
        .filter(
            StudySchedule.user_id == user_id,
            StudySchedule.is_deleted == False,
            ScheduleItem.tenant_id == tenant_id,
            ScheduleItem.scheduled_date == today_str,
            ScheduleItem.status == "pending",
            ScheduleItem.is_deleted == False,
        )
        .order_by(ScheduleItem.order)
        .all()
    )

    result = []
    for item in items:
        data = {
            "id": item.id, "type": item.item_type, "item_type": item.item_type,
            "estimated_minutes": item.estimated_minutes,
            "priority_reason": item.priority_reason, "status": item.status,
        }
        if item.lesson_id and item.lesson:
            data["lesson"] = {"id": item.lesson.id, "title": item.lesson.title, "duration_minutes": item.lesson.duration_minutes}
            data["lesson_title"] = item.lesson.title
        if item.subject_id and item.subject:
            data["subject"] = {"id": item.subject.id, "name": item.subject.name, "color": item.subject.color}
            data["subject_name"] = item.subject.name
        result.append(data)
    return result


# ══════════════════════════════════════════════════════════════════════════════
# BATCH STATS — substitui _get_student_quick_stats em loop
# OTIMIZAÇÃO v3: era 4 queries por aluno × N alunos. Agora 3 queries para todos.
# ══════════════════════════════════════════════════════════════════════════════


def _get_batch_student_stats(student_ids: list, tenant_id: str) -> dict:
    """Retorna stats de todos os alunos em 3 queries agregadas."""
    if not student_ids:
        return {}

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    q_rows = (
        db.session.query(
            QuestionAttempt.user_id,
            func.count(QuestionAttempt.id).label("total"),
            func.sum(case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
            func.max(QuestionAttempt.created_at).label("last_at"),
        )
        .filter(
            QuestionAttempt.user_id.in_(student_ids),
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.is_deleted == False,
        )
        .group_by(QuestionAttempt.user_id)
        .all()
    )

    q_by_user = {
        str(r.user_id): {
            "total": r.total or 0,
            "correct": r.correct or 0,
            "last_at": r.last_at,
        }
        for r in q_rows
    }

    l_rows = (
        db.session.query(
            LessonProgress.user_id,
            func.count(LessonProgress.id).label("watched"),
        )
        .filter(
            LessonProgress.user_id.in_(student_ids),
            LessonProgress.tenant_id == tenant_id,
            LessonProgress.status == "watched",
            LessonProgress.is_deleted == False,
        )
        .group_by(LessonProgress.user_id)
        .all()
    )

    lessons_by_user = {str(r.user_id): r.watched for r in l_rows}

    result = {}
    for sid in student_ids:
        sid_str = str(sid)
        q = q_by_user.get(sid_str, {"total": 0, "correct": 0, "last_at": None})
        total = q["total"]
        correct = q["correct"]
        last_at = q["last_at"]
        is_at_risk = not last_at or last_at < seven_days_ago

        result[sid_str] = {
            "total_answered": total,
            "accuracy_rate": round((correct / total) * 100, 1) if total else 0,
            "last_activity": last_at.isoformat() if last_at else None,
            "lessons_watched": lessons_by_user.get(sid_str, 0),
            "is_at_risk": is_at_risk,
        }

    return result


def _get_student_quick_stats(user_id: str, tenant_id: str) -> dict:
    """Compat wrapper — usa batch de 1 aluno."""
    return _get_batch_student_stats([user_id], tenant_id).get(str(user_id), {
        "total_answered": 0, "accuracy_rate": 0,
        "last_activity": None, "lessons_watched": 0, "is_at_risk": True,
    })


# ══════════════════════════════════════════════════════════════════════════════
# AT RISK STUDENTS
# ══════════════════════════════════════════════════════════════════════════════


def _get_at_risk_students(student_ids: list, tenant_id: str) -> list:
    if not student_ids:
        return []

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    three_days_ago = now - timedelta(days=3)

    students = User.query.filter(User.id.in_(student_ids)).all()
    student_map = {str(s.id): s for s in students}

    batch = _get_batch_student_stats(student_ids, tenant_id)

    recent_rows = (
        db.session.query(
            QuestionAttempt.user_id,
            func.count(QuestionAttempt.id).label("recent_count"),
        )
        .filter(
            QuestionAttempt.user_id.in_(student_ids),
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.is_deleted == False,
            QuestionAttempt.created_at >= seven_days_ago,
        )
        .group_by(QuestionAttempt.user_id)
        .all()
    )
    recent_by_user = {str(r.user_id): r.recent_count for r in recent_rows}

    at_risk = []
    for sid in student_ids:
        sid_str = str(sid)
        student = student_map.get(sid_str)
        if not student:
            continue

        created_at = student.created_at
        if created_at:
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            if created_at >= three_days_ago:
                continue

        if recent_by_user.get(sid_str, 0) >= 10:
            continue

        stats = batch.get(sid_str, {})
        total = stats.get("total_answered", 0)
        last_activity_str = stats.get("last_activity")
        last_at = datetime.fromisoformat(last_activity_str) if last_activity_str else None

        risk_score = 0.0
        risk_reasons = []

        if not last_at:
            risk_score += 0.4
            risk_reasons.append("Nunca respondeu questões")
        elif last_at < seven_days_ago:
            days_inactive = (now - last_at).days
            risk_score += min(0.4, days_inactive * 0.05)
            risk_reasons.append(f"Inativo há {days_inactive} dias")

        if total >= 10:
            correct = round(stats.get("accuracy_rate", 0) * total / 100)
            accuracy = correct / total if total else 0
            if accuracy < 0.30:
                risk_score += 0.2
                risk_reasons.append(f"Taxa de acerto muito baixa ({round(accuracy * 100)}%)")

        if risk_score >= 0.3:
            at_risk.append({
                "id": student.id,
                "name": student.name,
                "email": student.email,
                "risk_score": round(min(risk_score, 1.0), 2),
                "risk_level": "alto" if risk_score >= 0.7 else "médio",
                "risk_reasons": risk_reasons,
                "last_activity": last_activity_str,
            })

    return sorted(at_risk, key=lambda x: x["risk_score"], reverse=True)


# ══════════════════════════════════════════════════════════════════════════════
# CLASS DISCIPLINE STATS
# ══════════════════════════════════════════════════════════════════════════════


def _get_class_discipline_stats(student_ids: list, tenant_id: str) -> list:
    if not student_ids:
        return []

    rows = (
        db.session.query(
            Question.discipline.label("discipline"),
            func.count(QuestionAttempt.id).label("total"),
            func.sum(case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
        )
        .join(Question, QuestionAttempt.question_id == Question.id)
        .filter(
            QuestionAttempt.user_id.in_(student_ids),
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.is_deleted == False,
        )
        .group_by(Question.discipline)
        .all()
    )

    result = []
    for row in rows:
        disc = row.discipline or "Sem disciplina"
        total = row.total or 0
        correct = row.correct or 0
        accuracy = round((correct / total) * 100, 1) if total else 0
        result.append({
            "discipline": disc,
            "total_attempts": total,
            "accuracy_rate": accuracy,
            "performance_label": _performance_label(accuracy),
        })

    return sorted(result, key=lambda x: x["accuracy_rate"])


def _get_hardest_questions(tenant_id: str) -> list:
    questions = (
        Question.query.filter_by(tenant_id=tenant_id, is_active=True, is_deleted=False)
        .filter(Question.total_attempts >= 3)
        .order_by(Question.correct_attempts / Question.total_attempts)
        .limit(20)
        .all()
    )
    return [{
        "id": q.id,
        "statement_preview": q.statement[:100] + "..." if len(q.statement) > 100 else q.statement,
        "discipline": q.discipline,
        "topic": q.topic,
        "difficulty": q.difficulty.value if q.difficulty else None,
        "accuracy_rate": round(q.accuracy_rate * 100, 1),
        "total_attempts": q.total_attempts,
    } for q in questions]


# ══════════════════════════════════════════════════════════════════════════════
# STUDENT RANKINGS
# ══════════════════════════════════════════════════════════════════════════════


def _get_student_rankings(student_ids: list, tenant_id: str) -> dict:
    if not student_ids:
        return {"top_performers": [], "needs_attention": []}

    now = datetime.now(timezone.utc)
    one_day_ago = now - timedelta(days=1)

    students = User.query.filter(User.id.in_(student_ids)).all()
    batch = _get_batch_student_stats(student_ids, tenant_id)

    student_stats = []
    for student in students:
        sid_str = str(student.id)
        stats = batch.get(sid_str, {})
        created_at = student.created_at
        if created_at and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        student_stats.append({
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "created_at": created_at,
            **stats,
        })

    with_activity = [s for s in student_stats if s["total_answered"] > 0]
    top_performers = sorted(with_activity, key=lambda x: x["accuracy_rate"], reverse=True)[:5]

    needs_attention = []
    for s in student_stats:
        created_at = s.get("created_at")
        if created_at and created_at > one_day_ago:
            continue
        reason = None
        if s["total_answered"] == 0:
            reason = "Nunca respondeu questões"
        elif s["accuracy_rate"] < 40 and s.get("is_at_risk"):
            reason = f"Taxa de acerto baixa: {s['accuracy_rate']}%"
        if reason:
            needs_attention.append({**s, "attention_reason": reason})

    for s in top_performers:
        s.pop("created_at", None)
    for s in needs_attention:
        s.pop("created_at", None)

    return {
        "top_performers": top_performers,
        "needs_attention": needs_attention[:10],
    }


# ══════════════════════════════════════════════════════════════════════════════
# INSIGHTS AUTOMÁTICOS VIA GEMINI
# ══════════════════════════════════════════════════════════════════════════════

_INSIGHT_THEME_VOICE = {
    "militar": {"persona": "instrutor militar experiente preparando candidatos a concursos das Forças Armadas e Polícias Militares", "meta": "missão semanal", "estudo": "instrução", "fraqueza": "vulnerabilidade tática", "proximo": "próxima ordem do dia", "chamada": "Soldado", "tom": "Direto, objetivo, sem rodeios. Use termos militares de forma natural (missão, instrução, posição, combate ao edital)."},
    "policial": {"persona": "delegado experiente preparando candidatos a concursos da Polícia Civil, Federal e PRF", "meta": "ocorrência semanal", "estudo": "diligência", "fraqueza": "pista não elucidada", "proximo": "próxima diligência", "chamada": "Investigador", "tom": "Investigativo e metódico. Use termos policiais naturalmente (caso, inquérito, diligência, evidência)."},
    "juridico": {"persona": "advogado sênior orientando candidatos à Magistratura, Ministério Público e OAB", "meta": "processo semanal", "estudo": "sustentação oral", "fraqueza": "tese não consolidada", "proximo": "próximo fundamento jurídico", "chamada": "Bacharel", "tom": "Formal e preciso. Use termos jurídicos naturalmente (tese, fundamentação, jurisprudência, doutrina)."},
    "fiscal": {"persona": "auditor-fiscal da Receita Federal orientando candidatos a concursos fiscais e de controle", "meta": "relatório semanal", "estudo": "análise fiscal", "fraqueza": "inconsistência detectada", "proximo": "próximo lançamento", "chamada": "Analista", "tom": "Técnico e orientado a conformidade. Use termos fiscais (auditoria, lançamento, conformidade, auto de infração)."},
    "administrativo": {"persona": "gestor público experiente orientando candidatos a concursos administrativos gerais", "meta": "meta semanal", "estudo": "desenvolvimento profissional", "fraqueza": "gap identificado", "proximo": "próxima entrega", "chamada": "Analista", "tom": "Corporativo e orientado a resultado. Use termos de gestão (produtividade, entrega, desenvolvimento, metas)."},
    "saude": {"persona": "coordenador de saúde pública orientando candidatos a concursos da área de saúde", "meta": "protocolo semanal", "estudo": "capacitação", "fraqueza": "indicador abaixo do esperado", "proximo": "próxima prescrição de estudos", "chamada": "Especialista", "tom": "Cuidadoso e baseado em evidência. Use termos de saúde (protocolo, diagnóstico, indicador, prescrição de estudos)."},
}

_NEXT_ACTION_MAP = {
    "create_schedule": {"cta_url": "/schedule", "cta_label": "Criar cronograma", "icon": "📅"},
    "watch_lesson": {"cta_url": "/schedule", "cta_label": "Ver cronograma", "icon": "▶️"},
    "practice_discipline": {"cta_url": "/questions", "cta_label": "Praticar questões", "icon": "⚠️"},
    "do_questions": {"cta_url": "/questions", "cta_label": "Responder questões", "icon": "📝"},
    "daily_questions": {"cta_url": "/questions", "cta_label": "Responder questões", "icon": "🎯"},
    "improve_discipline": {"cta_url": "/questions", "cta_label": "Praticar", "icon": "📚"},
    "view_schedule": {"cta_url": "/schedule", "cta_label": "Ver cronograma", "icon": "📋"},
    "keep_going": {"cta_url": "/questions", "cta_label": "Continuar estudando", "icon": "🏆"},
}


def _generate_insights(user, tenant, questions_stats, discipline_stats, lesson_progress,
                       weekly_mission=None, todays_pending=None) -> list:
    api_key = current_app.config.get("GEMINI_API_KEY", "")
    weekly_mission = weekly_mission or {}
    todays_pending = todays_pending or []

    if api_key:
        try:
            return _gemini_student_insights(
                api_key=api_key, user=user, tenant=tenant,
                questions_stats=questions_stats, discipline_stats=discipline_stats,
                lesson_progress=lesson_progress, weekly_mission=weekly_mission,
                todays_pending=todays_pending,
            )
        except Exception as e:
            current_app.logger.warning(f"Gemini insights falhou, usando fallback: {e}")

    return _rule_based_insights(questions_stats, discipline_stats, lesson_progress, weekly_mission, todays_pending)


@analytics_bp.route("/student/<user_id>/insights/regenerate", methods=["POST"])
@jwt_required()
@require_tenant
def regenerate_student_insights(user_id: str):
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    target_user = User.query.filter_by(id=user_id, tenant_id=tenant.id, is_deleted=False).first()
    if not target_user:
        return jsonify({"error": "user_not_found"}), 404

    _delete_cached_insights(user_id, tenant.id)
    _cache_delete(_dashboard_cache_key(user_id, tenant.id))

    now = datetime.now(timezone.utc)
    now_brt = now.astimezone(BRT)
    today_start = now_brt.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    week_start = today_start - timedelta(days=now_brt.weekday())

    questions_stats = _get_questions_stats(user_id, tenant.id, today_start, week_start)
    discipline_stats = _get_discipline_stats(user_id, tenant.id)
    lesson_progress = _get_lesson_progress_stats(user_id, tenant.id)
    todays_pending = _get_todays_pending(user_id, tenant.id, today_start)
    weekly_mission = _get_weekly_mission(user_id, tenant.id, discipline_stats)

    insights = _generate_insights(
        user=target_user, tenant=tenant, questions_stats=questions_stats,
        discipline_stats=discipline_stats, lesson_progress=lesson_progress,
        weekly_mission=weekly_mission, todays_pending=todays_pending,
    )
    _set_cached_insights(user_id, tenant.id, insights)
    return jsonify({"insights": insights}), 200


@analytics_bp.route("/student/<user_id>/insights", methods=["PUT"])
@jwt_required()
@require_tenant
def update_student_insights(user_id: str):
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    target_user = User.query.filter_by(id=user_id, tenant_id=tenant.id, is_deleted=False).first()
    if not target_user:
        return jsonify({"error": "user_not_found"}), 404

    body = request.get_json(silent=True) or {}
    insights = body.get("insights")

    if not isinstance(insights, list) or len(insights) == 0:
        return jsonify({"error": "invalid_payload", "detail": "insights deve ser uma lista não vazia"}), 400

    for item in insights:
        if not isinstance(item, dict) or not item.get("title") or not item.get("message"):
            return jsonify({"error": "invalid_insight", "detail": "Cada insight precisa de title e message"}), 400

    _set_cached_insights(user_id, tenant.id, insights)
    _cache_delete(_dashboard_cache_key(user_id, tenant.id))
    return jsonify({"insights": insights}), 200


@analytics_bp.route("/student/next-action", methods=["GET"])
@jwt_required()
@require_tenant
def student_next_action():
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    cache_key = f"next_action:{tenant.id}:{user_id}"
    cached = _cache_get(cache_key)
    if cached:
        return jsonify(cached), 200

    user = User.query.filter_by(id=user_id, tenant_id=tenant.id, is_deleted=False).first()
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    action = _determine_next_action(user_id, tenant.id, user, tenant)
    # TTL aumentado de 15min (900s) para 4h (14400s).
    # A invalidação agora é orientada por eventos (criar/deletar cronograma,
    # responder questão, checkin/uncheckin de aula), tornando o TTL longo seguro.
    _cache_set(cache_key, action, ttl_seconds=14400)
    return jsonify(action), 200

def _determine_next_action(user_id, tenant_id, user, tenant) -> dict:
    context = _build_student_context_for_action(user_id, tenant_id)

    # Gate de prioridade absoluta — cronograma sempre vence, sem precisar do Gemini
    sched = context["schedule"]
    if not sched["has_schedule"]:
        # Sem cronograma → Gemini decide (provavelmente create_schedule)
        pass
    elif sched["today_pending"]:
        # Tem item pendente hoje → retorna diretamente sem chamar Gemini
        first = sched["today_pending"][0]
        if first["item_type"] == "lesson":
            base = _NEXT_ACTION_MAP["watch_lesson"]
            return {
                **base,
                "action_type": "watch_lesson",
                "cta_params": {},
                "priority": "high",
                "title": "Sua aula de hoje te espera",
                "message": f'"{first["lesson_title"]}" está no cronograma de hoje. Assista antes de praticar questões.',
            }
        else:
            disc = first.get("subject_name")
            base = _NEXT_ACTION_MAP["do_questions"]
            return {
                **base,
                "action_type": "do_questions",
                "cta_params": {"discipline": disc} if disc else {},
                "priority": "high",
                "title": "Questões do cronograma de hoje",
                "message": f"Questões programadas{f' de {disc}' if disc else ''}. Siga o cronograma!",
            }

    # Só chega aqui se: tem cronograma mas sem pendências hoje
    api_key = current_app.config.get("GEMINI_API_KEY", "")
    if api_key:
        try:
            return _gemini_next_action(user, tenant, context, api_key)
        except Exception as e:
            current_app.logger.warning(f"[GEMINI] next_action falhou: {e}")
    return _rule_based_next_action(context)


def _build_student_context_for_action(user_id, tenant_id) -> dict:
    today = datetime.now(BRT).date()
    today_str = today.isoformat()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    schedule = StudySchedule.query.filter_by(
        user_id=user_id, tenant_id=tenant_id, is_deleted=False, status="active"
    ).first()

    schedule_ctx = {"has_schedule": False, "today_pending": [], "week_progress": None}

    if schedule:
        schedule_ctx["has_schedule"] = True
        today_items = (
            ScheduleItem.query.filter(
                ScheduleItem.schedule_id == schedule.id,
                ScheduleItem.scheduled_date == today_str,
                ScheduleItem.status == "pending",
                ScheduleItem.is_deleted == False,
            )
            .order_by(ScheduleItem.order)
            .all()
        )
        schedule_ctx["today_pending"] = [{
            "item_type": i.item_type,
            "lesson_title": i.lesson.title if i.lesson_id and i.lesson else None,
            "subject_name": i.subject.name if i.subject_id and i.subject else None,
            "estimated_minutes": i.estimated_minutes,
            "lesson_id": i.lesson_id,
        } for i in today_items[:5]]

        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        week_items = ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date >= week_start.isoformat(),
            ScheduleItem.scheduled_date <= week_end.isoformat(),
            ScheduleItem.is_deleted == False,
        ).all()

        total_week = len(week_items)
        done_week = sum(1 for i in week_items if i.status == "done")
        schedule_ctx["week_progress"] = {
            "total": total_week, "done": done_week,
            "pct": round((done_week / total_week) * 100, 1) if total_week else 0,
        }

    discipline_stats = _get_discipline_stats(user_id, tenant_id)
    critical = [d for d in discipline_stats if d["accuracy_rate"] < 40 and d["total_answered"] >= 5]
    weak = [d for d in discipline_stats if 40 <= d["accuracy_rate"] < 60 and d["total_answered"] >= 5]
    strong = [d for d in discipline_stats if d["accuracy_rate"] >= 70]

    today_count = (
        db.session.query(func.count(QuestionAttempt.id))
        .filter(
            QuestionAttempt.user_id == user_id,
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.is_deleted == False,
            QuestionAttempt.created_at >= today_start,
        )
        .scalar() or 0
    )

    total_row = (
        db.session.query(
            func.count(QuestionAttempt.id).label("total"),
            func.sum(case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
        )
        .filter(
            QuestionAttempt.user_id == user_id,
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.is_deleted == False,
        )
        .one()
    )
    total_q = total_row.total or 0
    accuracy = round((total_row.correct / total_q) * 100, 1) if total_q else 0

    lesson_progress = _get_lesson_progress_stats(user_id, tenant_id)

    return {
        "schedule": schedule_ctx,
        "disciplines": {
            "critical": sorted(critical, key=lambda x: x["accuracy_rate"])[:3],
            "weak": sorted(weak, key=lambda x: x["accuracy_rate"])[:3],
            "strong": sorted(strong, key=lambda x: x["accuracy_rate"], reverse=True)[:3],
        },
        "questions": {"total": total_q, "overall_accuracy": accuracy, "answered_today": today_count},
        "lessons": {"watched": lesson_progress["total_watched"], "available": lesson_progress["total_available"], "pct": lesson_progress["completion_rate"]},
    }


def _gemini_next_action(user, tenant, context, api_key) -> dict:
    from google import genai

    insight_theme = (tenant.settings or {}).get("insight_theme", "militar")
    voice = _INSIGHT_THEME_VOICE.get(insight_theme, _INSIGHT_THEME_VOICE["militar"])
    sched = context["schedule"]
    discs = context["disciplines"]
    questions = context["questions"]
    lessons = context["lessons"]

    critical_str = ", ".join(f"{d['discipline']} ({d['accuracy_rate']}%)" for d in discs["critical"]) or "nenhuma"
    weak_str = ", ".join(f"{d['discipline']} ({d['accuracy_rate']}%)" for d in discs["weak"]) or "nenhuma"
    strong_str = ", ".join(f"{d['discipline']} ({d['accuracy_rate']}%)" for d in discs["strong"]) or "nenhuma"
    pending_str = "; ".join(f"{i['item_type']} — {i['lesson_title'] or i['subject_name'] or 'sem título'}" for i in sched["today_pending"]) if sched["today_pending"] else "nenhuma"
    week_prog = sched.get("week_progress")
    week_str = f"{week_prog['done']}/{week_prog['total']} itens ({week_prog['pct']}%)" if week_prog else "sem dados"

    prompt = f"""Você é um assistente coach de estudos para concursos públicos com perfil de {voice['persona']}.
Analise o contexto do aluno e decida A ÚNICA ação mais importante que ele deve fazer AGORA.

CONTEXTO DO ALUNO ({user.name}):
- Tem cronograma ativo: {"Sim" if sched["has_schedule"] else "NÃO"}
- Pendências de hoje: {pending_str}
- Progresso semanal: {week_str}
- Questões respondidas hoje: {questions["answered_today"]}
- Acerto geral: {questions["overall_accuracy"]}%
- Disciplinas CRÍTICAS (<40%): {critical_str}
- Disciplinas fracas (40-60%): {weak_str}
- Disciplinas fortes (>70%): {strong_str}
- Aulas assistidas: {lessons["watched"]} de {lessons["available"]} ({lessons["pct"]}%)

PRIORIDADE: 1.create_schedule(sem cronograma) 2.watch_lesson(aula pendente hoje) 3.do_questions(questões pendentes hoje) 4.view_schedule(semana<50%) 5.practice_discipline(disc<40%) 6.daily_questions(sem questões hoje) 7.improve_discipline(disc 40-60%) 8.keep_going

Tom: {voice['tom']}. title: máx 6 palavras. message: máx 2 frases com dados reais.
Responda APENAS com JSON válido sem markdown:
{{"action_type":"...","title":"...","message":"...","priority":"high"|"medium"|"low","discipline_filter":"nome ou null"}}"""

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(model="gemini-2.5-flash-lite", contents=prompt)
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    parsed = json.loads(text.strip())
    action_type = parsed.get("action_type", "keep_going")
    if action_type not in _NEXT_ACTION_MAP:
        action_type = "keep_going"

    base = _NEXT_ACTION_MAP[action_type]
    disc_name = parsed.get("discipline_filter")
    cta_params = {"discipline": disc_name} if disc_name and action_type in ("practice_discipline", "improve_discipline", "do_questions") else {}
    current_app.logger.info(f"[GEMINI] next_action={action_type} user={user.id}")

    return {
        "action_type": action_type,
        "title": parsed.get("title", base["cta_label"]),
        "message": parsed.get("message", ""),
        "cta_label": base["cta_label"],
        "cta_url": base["cta_url"],
        "cta_params": cta_params,
        "icon": base["icon"],
        "priority": parsed.get("priority", "medium"),
    }


def _rule_based_next_action(context) -> dict:
    sched = context["schedule"]
    discs = context["disciplines"]
    questions = context["questions"]

    if not sched["has_schedule"]:
        base = _NEXT_ACTION_MAP["create_schedule"]
        return {**base, "action_type": "create_schedule", "cta_params": {}, "priority": "high", "title": "Crie seu cronograma", "message": "Um cronograma personalizado organiza seus estudos e aumenta suas chances de aprovação."}

    if sched["today_pending"]:
        first = sched["today_pending"][0]
        if first["item_type"] == "lesson":
            base = _NEXT_ACTION_MAP["watch_lesson"]
            return {**base, "action_type": "watch_lesson", "cta_params": {}, "priority": "high", "title": "Aula do dia te esperando", "message": f'"{first["lesson_title"]}" está no cronograma de hoje.'}
        disc = first.get("subject_name")
        base = _NEXT_ACTION_MAP["do_questions"]
        return {**base, "action_type": "do_questions", "cta_params": {"discipline": disc} if disc else {}, "priority": "high", "title": "Questões do cronograma de hoje", "message": f"Questões programadas para hoje{f' de {disc}' if disc else ''}. Mantenha o ritmo!"}

    if discs["critical"]:
        worst = discs["critical"][0]
        base = _NEXT_ACTION_MAP["practice_discipline"]
        return {**base, "action_type": "practice_discipline", "cta_params": {"discipline": worst["discipline"]}, "priority": "high", "title": f"Reforce {worst['discipline']}", "message": f"Acerto de {worst['accuracy_rate']}% — abaixo da meta. Resolva questões agora!"}

    if questions["answered_today"] == 0:
        base = _NEXT_ACTION_MAP["daily_questions"]
        return {**base, "action_type": "daily_questions", "cta_params": {}, "priority": "medium", "title": "Nenhuma questão hoje ainda", "message": "Que tal 10 questões agora? Consistência diária é o segredo."}

    base = _NEXT_ACTION_MAP["keep_going"]
    return {**base, "action_type": "keep_going", "cta_params": {}, "priority": "low", "title": "Você está indo bem!", "message": f"Já respondeu {questions['answered_today']} questões hoje. Continue assim!"}


def _gemini_student_insights(api_key, user, tenant, questions_stats, discipline_stats,
                             lesson_progress, weekly_mission, todays_pending) -> list:
    from google import genai

    insight_theme = (tenant.settings or {}).get("insight_theme", "militar")
    voice = _INSIGHT_THEME_VOICE.get(insight_theme, _INSIGHT_THEME_VOICE["militar"])

    weak = [d for d in discipline_stats if d["performance_label"] == "fraco"]
    strong = [d for d in discipline_stats if d["performance_label"] == "forte"]
    weak_str = ", ".join(f"{d['discipline']} ({d['accuracy_rate']}%)" for d in weak[:3]) or "nenhuma"
    strong_str = ", ".join(f"{d['discipline']} ({d['accuracy_rate']}%)" for d in strong[:3]) or "nenhuma"

    has_schedule = weekly_mission.get("has_schedule", False)
    total_items = weekly_mission.get("total_items", 0)
    completed_items = weekly_mission.get("completed_items", 0)
    mission_pct = round((completed_items / total_items) * 100) if total_items > 0 else 0
    mission_str = "sem cronograma ativo" if not has_schedule or total_items == 0 else f"{completed_items}/{total_items} itens concluídos ({mission_pct}%)"

    pending_count = len(todays_pending)
    pending_labels = "; ".join(p.get("lesson_title") or p.get("subject_name") or p.get("item_type", "item") for p in todays_pending[:3]) if todays_pending else "nenhuma"

    prompt = f"""Você é um {voice['persona']}.
Gere EXATAMENTE 3 insights em português para o candidato abaixo.

DADOS:
- Nome: {user.name}
- {voice['meta'].capitalize()}: {mission_str}
- Pendências de hoje: {pending_count} item(ns) — {pending_labels}
- Questões respondidas hoje: {questions_stats['today']['answered']}
- Taxa de acerto geral: {questions_stats['overall_accuracy']}%
- Pontos fracos: {weak_str}
- Pontos fortes: {strong_str}
- Aulas assistidas: {lesson_progress['total_watched']} de {lesson_progress['total_available']}

TOM: {voice['tom']}. Chame de "{voice['chamada']}" UMA VEZ no primeiro insight. Máx 2 frases por insight.

ORDEM OBRIGATÓRIA:
1. type=motivation: progresso da {voice['meta']} ({mission_str})
2. type=next_step: pendências de hoje ({pending_count} item(ns))
3. type=weakness: pontos fracos ({weak_str}) e acerto de {questions_stats['overall_accuracy']}%

Responda APENAS com JSON válido sem markdown:
{{"insights":[{{"type":"motivation"|"weakness"|"next_step","icon":"emoji","title":"título curto","message":"mensagem prática"}}]}}"""

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(model="gemini-2.5-flash-lite", contents=prompt)
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    data = json.loads(text.strip())
    return data.get("insights", [])[:3]


def _generate_producer_insights(total_students, engagement_rate, at_risk_count, class_discipline_stats) -> list:
    insights = []
    if engagement_rate < 30:
        insights.append({"type": "alert", "icon": "🚨", "title": "Engajamento crítico", "message": f"Apenas {engagement_rate}% dos alunos acessaram a plataforma nos últimos 7 dias. Considere enviar uma notificação de reengajamento."})
    elif engagement_rate < 60:
        insights.append({"type": "warning", "icon": "⚠️", "title": "Engajamento abaixo do esperado", "message": f"{engagement_rate}% de engajamento semanal. Alunos engajados tendem a ter 3x mais chances de aprovação."})
    else:
        insights.append({"type": "positive", "icon": "✅", "title": "Boa taxa de engajamento", "message": f"{engagement_rate}% dos alunos ativos esta semana. Continue monitorando os {at_risk_count} em risco."})

    if at_risk_count > 0:
        risk_pct = round((at_risk_count / total_students) * 100, 1)
        insights.append({"type": "alert" if risk_pct > 20 else "warning", "icon": "⚠️", "title": f"{at_risk_count} alunos em risco de abandono", "message": f"{risk_pct}% da turma está inativa há mais de 7 dias. Entre em contato proativamente."})

    if class_discipline_stats:
        weakest = class_discipline_stats[0]
        insights.append({"type": "suggestion", "icon": "📚", "title": f"Atenção: {weakest['discipline']}", "message": f"A turma tem apenas {weakest['accuracy_rate']}% de acerto em {weakest['discipline']}. Considere criar material de revisão."})

    return insights[:3]


def _rule_based_insights(questions_stats, discipline_stats, lesson_progress,
                         weekly_mission=None, todays_pending=None) -> list:
    insights = []
    weekly_mission = weekly_mission or {}
    todays_pending = todays_pending or []

    has_schedule = weekly_mission.get("has_schedule", False)
    total_items = weekly_mission.get("total_items", 0)
    completed_items = weekly_mission.get("completed_items", 0)

    if not has_schedule or total_items == 0:
        insights.append({"type": "motivation", "icon": "📅", "title": "Crie seu cronograma semanal", "message": "Candidatos com cronograma têm 3x mais chances de aprovação. Configure o seu agora."})
    else:
        mission_pct = round((completed_items / total_items) * 100)
        remaining = total_items - completed_items
        if mission_pct >= 80:
            insights.append({"type": "positive", "icon": "🏆", "title": f"Missão quase cumprida — {mission_pct}%", "message": f"Você completou {completed_items} de {total_items} itens esta semana. Faltam apenas {remaining} para zerar!"})
        elif mission_pct >= 40:
            insights.append({"type": "motivation", "icon": "🎯", "title": f"Missão em andamento — {mission_pct}%", "message": f"{completed_items} de {total_items} itens concluídos. Restam {remaining} para completar a semana."})
        else:
            insights.append({"type": "warning", "icon": "📋", "title": f"Missão atrasada — {mission_pct}%", "message": f"Apenas {completed_items} de {total_items} itens concluídos. Retome o cronograma para não perder o ritmo."})

    pending_count = len(todays_pending)
    if pending_count > 0:
        first = todays_pending[0]
        item_label = first.get("lesson_title") or first.get("subject_name") or first.get("item_type", "item pendente")
        insights.append({"type": "next_step", "icon": "📌", "title": f"{pending_count} pendência(s) para hoje", "message": f"Próximo item: {item_label}. Cada aula concluída te aproxima da aprovação."})
    elif questions_stats["today"]["answered"] == 0:
        insights.append({"type": "next_step", "icon": "📌", "title": "Comece com questões hoje", "message": "Você ainda não respondeu nenhuma questão hoje. Que tal resolver 10 questões rápidas agora?"})
    else:
        insights.append({"type": "next_step", "icon": "✅", "title": "Agenda do dia em dia", "message": f"Você respondeu {questions_stats['today']['answered']} questões hoje. Continue praticando!"})

    weak = [d for d in discipline_stats if d["performance_label"] == "fraco"]
    if weak:
        weakest = weak[0]
        insights.append({"type": "weakness", "icon": "⚠️", "title": f"Foco em {weakest['discipline']}", "message": f"Sua taxa de acerto em {weakest['discipline']} está em {weakest['accuracy_rate']}%. Revise o material e pratique mais questões."})
    elif questions_stats["overall_accuracy"] < 50:
        insights.append({"type": "weakness", "icon": "⚠️", "title": "Reforce a teoria", "message": f"Com {questions_stats['overall_accuracy']}% de acerto geral, vale revisar o conteúdo antes de resolver mais questões."})
    else:
        insights.append({"type": "motivation", "icon": "💪", "title": "Bom desempenho!", "message": f"Taxa de acerto de {questions_stats['overall_accuracy']}%. Continue praticando para consolidar o conhecimento."})

    return insights[:3]