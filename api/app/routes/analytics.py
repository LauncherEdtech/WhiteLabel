# api/app/routes/analytics.py
# Dashboard do aluno + Analytics do produtor + Insights automáticos via Gemini.
# SEGURANÇA: Todas as queries filtram por tenant_id.
# Aluno só vê seus próprios dados. Produtor vê dados da turma.

from datetime import datetime, timezone, timedelta
from collections import defaultdict

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy import func, and_

from app.extensions import db, limiter
from app.models.user import User, UserRole
from app.models.course import Course, Subject, Lesson, LessonProgress, CourseEnrollment
from app.models.question import Question, QuestionAttempt
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn
from app.middleware.tenant import (
    resolve_tenant,
    require_tenant,
    require_feature,
    get_current_tenant,
)

analytics_bp = Blueprint("analytics", __name__)

# ── Helpers de autorização ────────────────────────────────────────────────────


def _is_producer_or_above(claims: dict) -> bool:
    return claims.get("role") in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    )


def _is_student(claims: dict) -> bool:
    return claims.get("role") == UserRole.STUDENT.value


def _get_lesson_stats_for_tenant(tenant_id: str, course_id: str = None) -> dict:
    courses_query = Course.query.filter_by(
        tenant_id=tenant_id,
        is_active=True,
        is_deleted=False,
    )
    if course_id:
        courses_query = courses_query.filter_by(id=course_id)
    courses = courses_query.all()

    total_lessons_platform = 0
    total_watched_platform = 0
    courses_stats = []
    all_lesson_stats = []

    for course in courses:
        course_lessons = 0
        course_watched = 0
        course_lesson_rows = []

        for subject in course.subjects:
            if subject.is_deleted:
                continue
            for module in subject.modules:
                if module.is_deleted:
                    continue
                for lesson in module.lessons:
                    if lesson.is_deleted or not lesson.is_published:
                        continue

                    watched_count = LessonProgress.query.filter_by(
                        lesson_id=lesson.id,
                        tenant_id=tenant_id,
                        status="watched",
                        is_deleted=False,
                    ).count()

                    enrolled = CourseEnrollment.query.filter_by(
                        course_id=course.id,
                        tenant_id=tenant_id,
                        is_active=True,
                        is_deleted=False,
                    ).count()

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

        enrolled_total = CourseEnrollment.query.filter_by(
            course_id=course.id,
            tenant_id=tenant_id,
            is_active=True,
            is_deleted=False,
        ).count()

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
                "enrolled_count": enrolled_total,
                "avg_completion": avg_completion,
                "lessons": sorted(
                    course_lesson_rows, key=lambda x: x["completion_pct"], reverse=True
                ),
            }
        )

        total_lessons_platform += course_lessons
        total_watched_platform += course_watched

    eligible = [r for r in all_lesson_stats if r["enrolled_count"] > 0]
    top_watched = sorted(eligible, key=lambda x: x["completion_pct"], reverse=True)[:5]
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
# DASHBOARD DO ALUNO
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

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    questions_stats = _get_questions_stats(
        target_user_id, tenant.id, today_start, week_start
    )
    discipline_stats = _get_discipline_stats(target_user_id, tenant.id)
    lesson_progress = _get_lesson_progress_stats(target_user_id, tenant.id)
    todays_pending = _get_todays_pending(target_user_id, tenant.id, today_start)
    time_stats = _get_time_stats(target_user_id, tenant.id, today_start, week_start)
    insights = _generate_insights(
        user=target_user,
        questions_stats=questions_stats,
        discipline_stats=discipline_stats,
        lesson_progress=lesson_progress,
        time_stats=time_stats,
    )

    return (
        jsonify(
            {
                "student": {
                    "id": target_user.id,
                    "name": target_user.name,
                },
                "questions": questions_stats,
                "discipline_performance": discipline_stats,
                "lesson_progress": lesson_progress,
                "time_studied": time_stats,
                "todays_pending": todays_pending,
                "insights": insights,
                "generated_at": now.isoformat(),
            }
        ),
        200,
    )


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
        return (
            jsonify(
                {
                    "overview": {
                        "total_students": 0,
                        "active_last_7_days": 0,
                        "engagement_rate": 0.0,
                        "at_risk_count": 0,
                    },
                    "at_risk_students": [],
                    "class_discipline_performance": [],
                    "hardest_questions": [],
                    "student_rankings": {"top_performers": [], "needs_attention": []},
                    "insights": [],
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }
            ),
            200,
        )

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
        .scalar()
        or 0
    )

    engagement_rate = (
        round((active_recently / total_students) * 100, 1) if total_students else 0
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

    return (
        jsonify(
            {
                "overview": {
                    "total_students": total_students,
                    "active_last_7_days": active_recently,
                    "engagement_rate": engagement_rate,
                    "at_risk_count": len(at_risk),
                },
                "at_risk_students": at_risk[:10],
                "class_discipline_performance": class_discipline_stats,
                "hardest_questions": hardest_questions[:10],
                "student_rankings": student_rankings,
                "lesson_stats": lesson_stats,
                "insights": producer_insights,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        ),
        200,
    )


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
    students = query.order_by(User.name).paginate(
        page=page, per_page=per_page, error_out=False
    )

    students_data = []
    for student in students.items:
        stats = _get_student_quick_stats(student.id, tenant.id)
        students_data.append(
            {
                "id": student.id,
                "name": student.name,
                "email": student.email,
                "created_at": (
                    student.created_at.isoformat() if student.created_at else None
                ),
                **stats,
            }
        )

    return (
        jsonify(
            {
                "students": students_data,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "pages": students.pages,
                },
            }
        ),
        200,
    )



# ══════════════════════════════════════════════════════════════════════════════
# CÁPSULA DE ESTUDOS — compartilhamento mensal do aluno
# ══════════════════════════════════════════════════════════════════════════════

@analytics_bp.route("/student/study-capsule", methods=["GET"])
@jwt_required()
@require_tenant
def student_study_capsule():
    """
    Agrega dados do aluno para um mês específico e gera a cápsula de estudos.
    Parâmetros: ?month=4&year=2026
    Retorna dados estruturados + frase Gemini (cached Redis 24h).
    """
    from calendar import monthrange
    from app.models.gamification import StudentBadge
    from app.services.badge_engine import BADGES, RANKS

    tenant = get_current_tenant()
    user_id = get_jwt_identity()
    claims = get_jwt()

    # Produtor pode ver qualquer aluno
    if _is_producer_or_above(claims):
        target_user_id = request.args.get("user_id", user_id)
    else:
        target_user_id = user_id

    user = User.query.filter_by(
        id=target_user_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    # ── Período ───────────────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    try:
        month = int(request.args.get("month", now.month))
        year  = int(request.args.get("year",  now.year))
    except ValueError:
        return jsonify({"error": "invalid_params"}), 400

    _, last_day = monthrange(year, month)
    period_start = datetime(year, month, 1, tzinfo=timezone.utc)
    period_end   = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
    period_start_iso = period_start.isoformat()
    period_end_iso   = period_end.isoformat()

    # ── 1. Questões do período ────────────────────────────────────────────────
    from app.models.simulado import SimuladoAttempt

    attempts = QuestionAttempt.query.filter(
        QuestionAttempt.user_id == target_user_id,
        QuestionAttempt.tenant_id == tenant.id,
        QuestionAttempt.is_deleted == False,
        QuestionAttempt.created_at >= period_start,
        QuestionAttempt.created_at <= period_end,
    ).all()

    questions_answered = len(attempts)
    questions_correct  = sum(1 for a in attempts if a.is_correct)
    accuracy_rate = round((questions_correct / questions_answered) * 100, 1) if questions_answered else 0

    # Tempo via questões (excluindo simulados)
    practice_attempts = [a for a in attempts if a.context != "simulado"]
    questions_seconds = sum(a.response_time_seconds or 0 for a in practice_attempts)

    # ── 2. Aulas do período ───────────────────────────────────────────────────
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

    # ── 3. Simulados do período ───────────────────────────────────────────────
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

    # ── 4. Top disciplinas do período ─────────────────────────────────────────
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

    # ── 5. Rank atual ─────────────────────────────────────────────────────────
    from app.services.badge_engine import BadgeEngine, get_rank, BADGES
    from app.models.gamification import StudentBadge as _StudentBadge

    _earned_points = sum(
        BADGES[b.badge_key]["points"]
        for b in _StudentBadge.query.filter_by(
            user_id=target_user_id,
            tenant_id=tenant.id,
            is_deleted=False,
        ).all()
        if b.badge_key in BADGES
    )
    current_rank = get_rank(_earned_points)
    # Badge destaque do período (mais recente conquistada no mês)
    period_badges = StudentBadge.query.filter(
        StudentBadge.user_id == target_user_id,
        StudentBadge.tenant_id == tenant.id,
        StudentBadge.earned_at >= period_start_iso,
        StudentBadge.earned_at <= period_end_iso,
    ).order_by(StudentBadge.earned_at.desc()).first()

    highlight_badge = None
    if period_badges:
        b = BADGES.get(period_badges.badge_key, {})
        highlight_badge = {
            "key": period_badges.badge_key,
            "name": b.get("name", period_badges.badge_key),
            "icon": b.get("icon", "🏆"),
        }

    # ── 6. Streak (dias únicos com atividade no mês) ──────────────────────────
    active_days = set()
    for a in attempts:
        if a.created_at:
            active_days.add(a.created_at.date())
    streak_days = len(active_days)

    # ── 7. Frase Gemini (cached Redis 24h) ───────────────────────────────────
    ai_phrase = _get_capsule_phrase(
        user=user,
        month=month, year=year,
        total_minutes=total_minutes,
        questions_answered=questions_answered,
        accuracy_rate=accuracy_rate,
        top_disciplines=top_disciplines,
        rank_name=current_rank.get("name", "Recruta"),
        tenant_id=tenant.id,
    )

    # ── 8. Dados do tenant para o card ────────────────────────────────────────
    branding = tenant.branding or {}
    months_pt = ["janeiro","fevereiro","março","abril","maio","junho",
                  "julho","agosto","setembro","outubro","novembro","dezembro"]

    return jsonify({
        "period_label":      f"{months_pt[month - 1]} {year}",
        "month":             month,
        "year":              year,
        "student_name":      user.name,
        "rank":              current_rank,
        "total_minutes":     total_minutes,
        "questions_answered": questions_answered,
        "accuracy_rate":     accuracy_rate,
        "lessons_watched":   lessons_watched,
        "top_disciplines":   top_disciplines,
        "highlight_badge":   highlight_badge,
        "streak_days":       streak_days,
        "ai_phrase":         ai_phrase,
        "tenant_name":       branding.get("platform_name", tenant.name),
        "tenant_logo_url":   branding.get("logo_url"),
        "tenant_primary_color": branding.get("primary_color", "#6366f1"),
        "capsule_style":     branding.get("capsule_style", "operativo"),
        "generated_at":      now.isoformat(),
    }), 200


def _get_capsule_phrase(
    user, month: int, year: int,
    total_minutes: int, questions_answered: int,
    accuracy_rate: float, top_disciplines: list,
    rank_name: str, tenant_id: str,
) -> str:
    """Gera frase motivacional via Gemini, cached Redis 24h."""
    from flask import current_app

    cache_key = f"capsule_phrase:{tenant_id}:{user.id}:{year}:{month}"

    # Tenta Redis
    try:
        from app.extensions import redis_client
        cached = redis_client.get(cache_key)
        if cached:
            return cached.decode("utf-8")
    except Exception:
        pass

    phrase = _fallback_capsule_phrase(
        rank_name, total_minutes, questions_answered, accuracy_rate
    )

    api_key = current_app.config.get("GEMINI_API_KEY", "")
    if api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.5-flash-lite")

            top_disc_str = ", ".join(d["discipline"] for d in top_disciplines[:2]) or "sem dados"
            prompt = f"""
Crie uma frase motivacional personalizada para um aluno de concursos públicos.
MÁXIMO 120 caracteres. Em português. Tom encorajador e direto.
Mencione a patente "{rank_name}" e pelo menos um dado real abaixo.

Dados do aluno em {month}/{year}:
- Minutos estudados: {total_minutes}
- Questões respondidas: {questions_answered}
- Taxa de acerto: {accuracy_rate}%
- Melhores disciplinas: {top_disc_str}
- Patente: {rank_name}

Responda APENAS com a frase, sem aspas, sem explicação."""

            response = model.generate_content(prompt)
            phrase = response.text.strip()[:150]
        except Exception as e:
            current_app.logger.warning(f"Gemini capsule phrase falhou: {e}")

    # Salva no Redis por 24h
    try:
        from app.extensions import redis_client
        redis_client.setex(cache_key, 86400, phrase.encode("utf-8"))
    except Exception:
        pass

    return phrase


def _fallback_capsule_phrase(
    rank_name: str, total_minutes: int,
    questions_answered: int, accuracy_rate: float,
) -> str:
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
# HELPERS DE CÁLCULO
# ══════════════════════════════════════════════════════════════════════════════


def _get_questions_stats(
    user_id: str, tenant_id: str, today_start: datetime, week_start: datetime
) -> dict:
    all_attempts = QuestionAttempt.query.filter_by(
        user_id=user_id,
        tenant_id=tenant_id,
        is_deleted=False,
    ).all()

    total = len(all_attempts)
    total_correct = sum(1 for a in all_attempts if a.is_correct)

    today_attempts = [
        a for a in all_attempts if a.created_at and a.created_at >= today_start
    ]
    today_total = len(today_attempts)
    today_correct = sum(1 for a in today_attempts if a.is_correct)

    week_attempts = [
        a for a in all_attempts if a.created_at and a.created_at >= week_start
    ]
    week_total = len(week_attempts)
    week_correct = sum(1 for a in week_attempts if a.is_correct)

    return {
        "total_answered": total,
        "total_correct": total_correct,
        "overall_accuracy": round((total_correct / total) * 100, 1) if total else 0,
        "today": {
            "answered": today_total,
            "correct": today_correct,
            "accuracy": (
                round((today_correct / today_total) * 100, 1) if today_total else 0
            ),
        },
        "this_week": {
            "answered": week_total,
            "correct": week_correct,
            "accuracy": (
                round((week_correct / week_total) * 100, 1) if week_total else 0
            ),
        },
    }


def _get_discipline_stats(user_id: str, tenant_id: str) -> list:
    attempts = QuestionAttempt.query.filter_by(
        user_id=user_id,
        tenant_id=tenant_id,
        is_deleted=False,
    ).all()

    by_discipline = defaultdict(
        lambda: {"total": 0, "correct": 0, "wrong": 0, "response_times": []}
    )

    for attempt in attempts:
        question = attempt.question
        if not question:
            continue
        disc = question.discipline or "Sem disciplina"
        by_discipline[disc]["total"] += 1
        if attempt.is_correct:
            by_discipline[disc]["correct"] += 1
        else:
            by_discipline[disc]["wrong"] += 1
        if attempt.response_time_seconds:
            by_discipline[disc]["response_times"].append(attempt.response_time_seconds)

    result = []
    for disc, stats in by_discipline.items():
        total = stats["total"]
        correct = stats["correct"]
        avg_time = (
            sum(stats["response_times"]) / len(stats["response_times"])
            if stats["response_times"]
            else 0
        )
        accuracy = round((correct / total) * 100, 1) if total else 0

        result.append(
            {
                "discipline": disc,
                "total_answered": total,
                "correct": correct,
                "wrong": stats["wrong"],
                "accuracy_rate": accuracy,
                "avg_response_time_seconds": round(avg_time, 1),
                "performance_label": _performance_label(accuracy),
            }
        )

    return sorted(result, key=lambda x: x["accuracy_rate"])


def _performance_label(accuracy: float) -> str:
    if accuracy >= 70:
        return "forte"
    elif accuracy >= 50:
        return "regular"
    else:
        return "fraco"


def _get_lesson_progress_stats(user_id: str, tenant_id: str) -> dict:
    progress_records = LessonProgress.query.filter_by(
        user_id=user_id,
        tenant_id=tenant_id,
        is_deleted=False,
    ).all()

    total_watched = sum(1 for p in progress_records if p.status == "watched")
    total_not_watched = sum(1 for p in progress_records if p.status == "not_watched")
    total_partial = sum(1 for p in progress_records if p.status == "partial")

    enrollments = CourseEnrollment.query.filter_by(
        user_id=user_id,
        tenant_id=tenant_id,
        is_active=True,
        is_deleted=False,
    ).all()

    course_ids = [e.course_id for e in enrollments]
    total_available = 0
    if course_ids:
        total_available = (
            db.session.query(func.count(Lesson.id))
            .join(
                Subject.__table__,
                Lesson.module_id.in_(
                    db.session.query(
                        db.session.query(Subject)
                        .filter(
                            Subject.course_id.in_(course_ids),
                            Subject.tenant_id == tenant_id,
                        )
                        .with_entities(Subject.id)
                        .subquery()
                    )
                ),
            )
            .filter(
                Lesson.is_published == True,
                Lesson.tenant_id == tenant_id,
                Lesson.is_deleted == False,
            )
            .scalar()
            or 0
        )

    completion_rate = (
        round((total_watched / total_available) * 100, 1) if total_available else 0
    )

    return {
        "total_watched": total_watched,
        "total_not_watched": total_not_watched,
        "total_partial": total_partial,
        "total_available": total_available,
        "completion_rate": completion_rate,
    }


def _get_time_stats(
    user_id: str, tenant_id: str, today_start: datetime, week_start: datetime
) -> dict:
    """
    Calcula tempo estudado baseado em três fontes:
    1. QuestionAttempt.response_time_seconds (prática avulsa / cronograma)
    2. LessonProgress: duração das aulas marcadas como assistidas
    3. SimuladoAttempt.total_time_seconds (tempo real de cada simulado concluído)

    NOTAS DE IMPLEMENTAÇÃO:
    - last_watched_at e finished_at são colunas String(50) no banco (ISO 8601)
      → comparações feitas com .isoformat() para consistência de tipos
    - Questões de contexto 'simulado' excluídas da fonte 1 para evitar
      dupla contagem com a fonte 3
    """
    from app.models.simulado import SimuladoAttempt

    # ── 1. Tempo via questões de prática / cronograma ─────────────────────────
    attempts_today = QuestionAttempt.query.filter(
        QuestionAttempt.user_id == user_id,
        QuestionAttempt.tenant_id == tenant_id,
        QuestionAttempt.is_deleted == False,
        QuestionAttempt.created_at >= today_start,
        QuestionAttempt.response_time_seconds.isnot(None),
        QuestionAttempt.context != "simulado",
    ).all()

    attempts_week = QuestionAttempt.query.filter(
        QuestionAttempt.user_id == user_id,
        QuestionAttempt.tenant_id == tenant_id,
        QuestionAttempt.is_deleted == False,
        QuestionAttempt.created_at >= week_start,
        QuestionAttempt.response_time_seconds.isnot(None),
        QuestionAttempt.context != "simulado",
    ).all()

    questions_time_today = sum(a.response_time_seconds or 0 for a in attempts_today)
    questions_time_week = sum(a.response_time_seconds or 0 for a in attempts_week)

    # ── 2. Tempo via aulas assistidas ─────────────────────────────────────────
    # last_watched_at é String(50) → .isoformat() para comparação correta
    lessons_watched_today = LessonProgress.query.filter(
        LessonProgress.user_id == user_id,
        LessonProgress.tenant_id == tenant_id,
        LessonProgress.status == "watched",
        LessonProgress.is_deleted == False,
        LessonProgress.last_watched_at >= today_start.isoformat(),
    ).all()

    lessons_time_today = 0
    for prog in lessons_watched_today:
        lesson = Lesson.query.get(prog.lesson_id)
        if lesson and lesson.duration_minutes:
            lessons_time_today += lesson.duration_minutes * 60

    lessons_watched_week = LessonProgress.query.filter(
        LessonProgress.user_id == user_id,
        LessonProgress.tenant_id == tenant_id,
        LessonProgress.status == "watched",
        LessonProgress.is_deleted == False,
        LessonProgress.last_watched_at >= week_start.isoformat(),
    ).all()

    lessons_time_week = 0
    for prog in lessons_watched_week:
        lesson = Lesson.query.get(prog.lesson_id)
        if lesson and lesson.duration_minutes:
            lessons_time_week += lesson.duration_minutes * 60

    # ── 3. Tempo via simulados concluídos ────────────────────────────────────
    # finished_at é String(50) → .isoformat() para comparação correta
    sim_today = SimuladoAttempt.query.filter(
        SimuladoAttempt.user_id == user_id,
        SimuladoAttempt.tenant_id == tenant_id,
        SimuladoAttempt.status.in_(["completed", "timed_out"]),
        SimuladoAttempt.total_time_seconds.isnot(None),
        SimuladoAttempt.finished_at >= today_start.isoformat(),
    ).all()
    simulado_time_today = sum(s.total_time_seconds or 0 for s in sim_today)

    sim_week = SimuladoAttempt.query.filter(
        SimuladoAttempt.user_id == user_id,
        SimuladoAttempt.tenant_id == tenant_id,
        SimuladoAttempt.status.in_(["completed", "timed_out"]),
        SimuladoAttempt.total_time_seconds.isnot(None),
        SimuladoAttempt.finished_at >= week_start.isoformat(),
    ).all()
    simulado_time_week = sum(s.total_time_seconds or 0 for s in sim_week)

    # ── Totais ────────────────────────────────────────────────────────────────
    total_today_seconds = (
        questions_time_today + lessons_time_today + simulado_time_today
    )
    total_week_seconds = questions_time_week + lessons_time_week + simulado_time_week

    # ── Meta semanal ──────────────────────────────────────────────────────────
    user = User.query.get(user_id)
    weekly_goal_hours = 0
    if user and user.study_availability:
        days_per_week = len(user.study_availability.get("days", []))
        hours_per_day = user.study_availability.get("hours_per_day", 2)
        weekly_goal_hours = days_per_week * hours_per_day

    weekly_goal_seconds = weekly_goal_hours * 3600
    weekly_progress_pct = (
        round((total_week_seconds / weekly_goal_seconds) * 100, 1)
        if weekly_goal_seconds
        else 0
    )

    return {
        "today_minutes": round(total_today_seconds / 60, 1),
        "week_minutes": round(total_week_seconds / 60, 1),
        "weekly_goal_hours": weekly_goal_hours,
        "weekly_goal_minutes": weekly_goal_hours * 60,
        "weekly_progress_percent": min(weekly_progress_pct, 100),
        "breakdown": {
            "today": {
                "questions_seconds": questions_time_today,
                "lessons_seconds": lessons_time_today,
                "simulados_seconds": simulado_time_today,
            },
            "week": {
                "questions_seconds": questions_time_week,
                "lessons_seconds": lessons_time_week,
                "simulados_seconds": simulado_time_week,
            },
        },
    }


def _get_todays_pending(user_id: str, tenant_id: str, today_start: datetime) -> list:
    today_str = today_start.date().isoformat()

    items = (
        ScheduleItem.query.join(StudySchedule)
        .filter(
            StudySchedule.user_id == user_id,
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
            "id": item.id,
            "type": item.item_type,
            "estimated_minutes": item.estimated_minutes,
            "priority_reason": item.priority_reason,
            "status": item.status,
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
        result.append(data)

    return result


def _get_at_risk_students(student_ids: list, tenant_id: str) -> list:
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    at_risk = []

    for student_id in student_ids:
        risk_score = 0.0
        risk_reasons = []

        last_attempt = (
            QuestionAttempt.query.filter_by(
                user_id=student_id,
                tenant_id=tenant_id,
                is_deleted=False,
            )
            .order_by(QuestionAttempt.created_at.desc())
            .first()
        )

        if not last_attempt:
            risk_score += 0.4
            risk_reasons.append("Nunca respondeu questões")
        elif last_attempt.created_at < seven_days_ago:
            days_inactive = (datetime.now(timezone.utc) - last_attempt.created_at).days
            risk_score += min(0.4, days_inactive * 0.05)
            risk_reasons.append(f"Inativo há {days_inactive} dias")

        total_attempts = QuestionAttempt.query.filter_by(
            user_id=student_id,
            tenant_id=tenant_id,
            is_deleted=False,
        ).count()

        correct_attempts = QuestionAttempt.query.filter_by(
            user_id=student_id,
            tenant_id=tenant_id,
            is_correct=True,
            is_deleted=False,
        ).count()

        if total_attempts >= 5:
            accuracy = correct_attempts / total_attempts
            if accuracy < 0.4:
                risk_score += 0.3
                risk_reasons.append(
                    f"Taxa de acerto muito baixa ({round(accuracy * 100)}%)"
                )

        not_watched = LessonProgress.query.filter_by(
            user_id=student_id,
            tenant_id=tenant_id,
            status="not_watched",
            is_deleted=False,
        ).count()

        if not_watched >= 3:
            risk_score += 0.2
            risk_reasons.append(f"{not_watched} aulas marcadas como não assistidas")

        if risk_score >= 0.3:
            student = User.query.get(student_id)
            if student:
                at_risk.append(
                    {
                        "id": student.id,
                        "name": student.name,
                        "email": student.email,
                        "risk_score": round(min(risk_score, 1.0), 2),
                        "risk_level": "alto" if risk_score >= 0.7 else "médio",
                        "risk_reasons": risk_reasons,
                        "last_activity": (
                            last_attempt.created_at.isoformat()
                            if last_attempt
                            else None
                        ),
                    }
                )

    return sorted(at_risk, key=lambda x: x["risk_score"], reverse=True)


def _get_class_discipline_stats(student_ids: list, tenant_id: str) -> list:
    attempts = QuestionAttempt.query.filter(
        QuestionAttempt.user_id.in_(student_ids),
        QuestionAttempt.tenant_id == tenant_id,
        QuestionAttempt.is_deleted == False,
    ).all()

    by_discipline = defaultdict(lambda: {"total": 0, "correct": 0})
    for attempt in attempts:
        try:
            question = attempt.question
        except Exception:
            continue
        if not question:
            continue
        disc = question.discipline or "Sem disciplina"
        by_discipline[disc]["total"] += 1
        if attempt.is_correct:
            by_discipline[disc]["correct"] += 1

    result = []
    for disc, stats in by_discipline.items():
        total = stats["total"]
        correct = stats["correct"]
        result.append(
            {
                "discipline": disc,
                "total_attempts": total,
                "accuracy_rate": round((correct / total) * 100, 1) if total else 0,
                "performance_label": _performance_label(
                    round((correct / total) * 100, 1) if total else 0
                ),
            }
        )

    return sorted(result, key=lambda x: x["accuracy_rate"])


def _get_hardest_questions(tenant_id: str) -> list:
    questions = (
        Question.query.filter_by(
            tenant_id=tenant_id,
            is_active=True,
            is_deleted=False,
        )
        .filter(Question.total_attempts >= 3)
        .order_by(Question.correct_attempts / Question.total_attempts)
        .limit(20)
        .all()
    )

    return [
        {
            "id": q.id,
            "statement_preview": (
                q.statement[:100] + "..." if len(q.statement) > 100 else q.statement
            ),
            "discipline": q.discipline,
            "topic": q.topic,
            "difficulty": q.difficulty.value if q.difficulty else None,
            "accuracy_rate": round(q.accuracy_rate * 100, 1),
            "total_attempts": q.total_attempts,
        }
        for q in questions
    ]


def _get_student_rankings(student_ids: list, tenant_id: str) -> dict:
    student_stats = []

    for student_id in student_ids:
        stats = _get_student_quick_stats(student_id, tenant_id)
        student = User.query.get(student_id)
        if student:
            student_stats.append({"id": student.id, "name": student.name, **stats})

    sorted_by_accuracy = sorted(
        [s for s in student_stats if s["total_answered"] > 0],
        key=lambda x: x["accuracy_rate"],
        reverse=True,
    )

    return {
        "top_performers": sorted_by_accuracy[:5],
        "needs_attention": (
            sorted_by_accuracy[-5:] if len(sorted_by_accuracy) > 5 else []
        ),
    }


def _get_student_quick_stats(user_id: str, tenant_id: str) -> dict:
    total = QuestionAttempt.query.filter_by(
        user_id=user_id,
        tenant_id=tenant_id,
        is_deleted=False,
    ).count()

    correct = QuestionAttempt.query.filter_by(
        user_id=user_id,
        tenant_id=tenant_id,
        is_correct=True,
        is_deleted=False,
    ).count()

    last_attempt = (
        QuestionAttempt.query.filter_by(
            user_id=user_id,
            tenant_id=tenant_id,
            is_deleted=False,
        )
        .order_by(QuestionAttempt.created_at.desc())
        .first()
    )

    lessons_watched = LessonProgress.query.filter_by(
        user_id=user_id,
        tenant_id=tenant_id,
        status="watched",
        is_deleted=False,
    ).count()

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    is_at_risk = not last_attempt or last_attempt.created_at < seven_days_ago

    return {
        "total_answered": total,
        "accuracy_rate": round((correct / total) * 100, 1) if total else 0,
        "last_activity": last_attempt.created_at.isoformat() if last_attempt else None,
        "lessons_watched": lessons_watched,
        "is_at_risk": is_at_risk,
    }


# ══════════════════════════════════════════════════════════════════════════════
# INSIGHTS AUTOMÁTICOS VIA GEMINI
# ══════════════════════════════════════════════════════════════════════════════


def _generate_insights(
    user,
    questions_stats: dict,
    discipline_stats: list,
    lesson_progress: dict,
    time_stats: dict,
) -> list:
    from flask import current_app

    api_key = current_app.config.get("GEMINI_API_KEY", "")

    if api_key:
        try:
            import google.generativeai as genai  # noqa

            return _gemini_student_insights(
                api_key,
                user,
                questions_stats,
                discipline_stats,
                lesson_progress,
                time_stats,
            )
        except Exception as e:
            current_app.logger.warning(f"Gemini insights falhou, usando fallback: {e}")

    return _rule_based_insights(
        questions_stats, discipline_stats, lesson_progress, time_stats
    )


def _gemini_student_insights(
    api_key: str,
    user,
    questions_stats: dict,
    discipline_stats: list,
    lesson_progress: dict,
    time_stats: dict,
) -> list:
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    weak = [d for d in discipline_stats if d["performance_label"] == "fraco"]
    strong = [d for d in discipline_stats if d["performance_label"] == "forte"]

    prompt = f"""
Você é um tutor especialista em concursos públicos. Analise os dados de estudo do aluno
e gere EXATAMENTE 3 insights práticos e motivadores em português.

DADOS DO ALUNO:
- Nome: {user.name}
- Questões respondidas hoje: {questions_stats['today']['answered']}
- Taxa de acerto geral: {questions_stats['overall_accuracy']}%
- Tempo estudado esta semana: {time_stats['week_minutes']} minutos
- Meta semanal: {time_stats['weekly_goal_minutes']} minutos ({time_stats['weekly_progress_percent']}% concluído)
- Aulas assistidas: {lesson_progress['total_watched']} de {lesson_progress['total_available']}
- Disciplinas fracas: {[d['discipline'] + ' (' + str(d['accuracy_rate']) + '%)' for d in weak[:3]]}
- Disciplinas fortes: {[d['discipline'] + ' (' + str(d['accuracy_rate']) + '%)' for d in strong[:3]]}

REGRAS:
1. Seja direto e específico (máximo 2 frases por insight)
2. Use dados reais do aluno nos insights
3. Um insight deve ser motivacional, um deve ser sobre ponto fraco, um deve ser sobre próximo passo
4. Responda APENAS com JSON válido, sem markdown, sem explicações

FORMATO OBRIGATÓRIO:
{{"insights": [{{"type": "motivation"|"weakness"|"next_step", "icon": "🎯"|"⚠️"|"📌", "title": "título curto", "message": "mensagem prática"}}]}}
"""

    response = model.generate_content(prompt)
    text = response.text.strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    import json

    data = json.loads(text)
    return data.get("insights", [])[:3]


def _generate_producer_insights(
    total_students: int,
    engagement_rate: float,
    at_risk_count: int,
    class_discipline_stats: list,
) -> list:
    insights = []

    if engagement_rate < 30:
        insights.append(
            {
                "type": "alert",
                "icon": "🚨",
                "title": "Engajamento crítico",
                "message": f"Apenas {engagement_rate}% dos alunos acessaram a plataforma nos últimos 7 dias. Considere enviar uma notificação ou e-mail de reengajamento.",
            }
        )
    elif engagement_rate < 60:
        insights.append(
            {
                "type": "warning",
                "icon": "⚠️",
                "title": "Engajamento abaixo do esperado",
                "message": f"{engagement_rate}% de engajamento semanal. Alunos engajados tendem a ter 3x mais chances de aprovação.",
            }
        )
    else:
        insights.append(
            {
                "type": "positive",
                "icon": "✅",
                "title": "Boa taxa de engajamento",
                "message": f"{engagement_rate}% dos alunos ativos esta semana. Continue monitorando os {at_risk_count} em risco.",
            }
        )

    if at_risk_count > 0:
        risk_pct = round((at_risk_count / total_students) * 100, 1)
        insights.append(
            {
                "type": "alert" if risk_pct > 20 else "warning",
                "icon": "⚠️",
                "title": f"{at_risk_count} alunos em risco de abandono",
                "message": f"{risk_pct}% da turma está inativa há mais de 7 dias. Entre em contato proativamente.",
            }
        )

    if class_discipline_stats:
        weakest = class_discipline_stats[0]
        insights.append(
            {
                "type": "suggestion",
                "icon": "📚",
                "title": f"Atenção: {weakest['discipline']}",
                "message": f"A turma tem apenas {weakest['accuracy_rate']}% de acerto em {weakest['discipline']}. Considere criar material de revisão ou aula extra sobre este tema.",
            }
        )

    return insights[:3]


def _rule_based_insights(
    questions_stats: dict,
    discipline_stats: list,
    lesson_progress: dict,
    time_stats: dict,
) -> list:
    insights = []

    progress_pct = time_stats["weekly_progress_percent"]
    if progress_pct >= 80:
        insights.append(
            {
                "type": "motivation",
                "icon": "🎯",
                "title": "Semana excelente!",
                "message": f"Você já completou {progress_pct}% da sua meta semanal. Continue assim — consistência é o segredo da aprovação.",
            }
        )
    elif progress_pct >= 40:
        remaining = time_stats["weekly_goal_minutes"] - time_stats["week_minutes"]
        insights.append(
            {
                "type": "motivation",
                "icon": "🎯",
                "title": "Você está no caminho certo",
                "message": f"Faltam apenas {round(remaining)} minutos para bater sua meta da semana. Você consegue!",
            }
        )
    else:
        insights.append(
            {
                "type": "next_step",
                "icon": "📌",
                "title": "Hora de retomar o ritmo",
                "message": f"Você completou {progress_pct}% da meta desta semana. Que tal reservar 30 minutos agora para estudar?",
            }
        )

    weak = [d for d in discipline_stats if d["performance_label"] == "fraco"]
    if weak:
        weakest = weak[0]
        insights.append(
            {
                "type": "weakness",
                "icon": "⚠️",
                "title": f"Foco em {weakest['discipline']}",
                "message": f"Sua taxa de acerto em {weakest['discipline']} está em {weakest['accuracy_rate']}%. Revise o material e pratique mais questões desta disciplina.",
            }
        )
    elif questions_stats["overall_accuracy"] < 50:
        insights.append(
            {
                "type": "weakness",
                "icon": "⚠️",
                "title": "Reforce a teoria",
                "message": f"Com {questions_stats['overall_accuracy']}% de acerto geral, vale revisar o conteúdo antes de resolver mais questões.",
            }
        )
    else:
        insights.append(
            {
                "type": "motivation",
                "icon": "💪",
                "title": "Bom desempenho!",
                "message": f"Taxa de acerto de {questions_stats['overall_accuracy']}%. Continue praticando para consolidar o conhecimento.",
            }
        )

    if lesson_progress["total_watched"] < lesson_progress["total_available"]:
        remaining_lessons = (
            lesson_progress["total_available"] - lesson_progress["total_watched"]
        )
        insights.append(
            {
                "type": "next_step",
                "icon": "📌",
                "title": f"{remaining_lessons} aulas para assistir",
                "message": "Assista às aulas pendentes antes de resolver questões — a base teórica aumenta o aproveitamento.",
            }
        )
    elif questions_stats["today"]["answered"] == 0:
        insights.append(
            {
                "type": "next_step",
                "icon": "📌",
                "title": "Comece com questões hoje",
                "message": "Você ainda não respondeu nenhuma questão hoje. Que tal resolver 10 questões rápidas agora?",
            }
        )
    else:
        insights.append(
            {
                "type": "next_step",
                "icon": "📌",
                "title": "Continue praticando",
                "message": f"Você respondeu {questions_stats['today']['answered']} questões hoje. Tente chegar a 20 para um estudo mais completo.",
            }
        )

    return insights[:3]
