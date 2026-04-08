# api/app/routes/gamification.py
# Rotas para avaliação de aulas e mural de honra (gamificação).

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE

from app.extensions import db, limiter
from app.models.user import User, UserRole
from app.models.course import Lesson, Module, Subject
from app.models.gamification import LessonRating, StudentBadge
from app.services.badge_engine import BadgeEngine, BADGES, RANKS
from app.middleware.tenant import resolve_tenant, require_tenant, get_current_tenant

gamification_bp = Blueprint("gamification", __name__)


def _is_producer_or_above(claims: dict) -> bool:
    return claims.get("role") in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    )


def _is_student(claims: dict) -> bool:
    return claims.get("role") == UserRole.STUDENT.value


# ── Schemas ───────────────────────────────────────────────────────────────────


class RatingSchema(Schema):
    rating = fields.Int(required=True, validate=validate.Range(min=1, max=5))
    comment = fields.Str(
        allow_none=True, load_default=None, validate=validate.Length(max=1000)
    )

    class Meta:
        unknown = EXCLUDE


@gamification_bp.before_request
def before_request():
    from app.middleware.tenant import resolve_tenant

    resolve_tenant()


# ══════════════════════════════════════════════════════════════════════════════
# AVALIAÇÃO DE AULAS
# ══════════════════════════════════════════════════════════════════════════════


@gamification_bp.route("/ratings/lessons/<string:lesson_id>", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("20 per hour")
def rate_lesson(lesson_id: str):
    """Aluno avalia uma aula (1-5 estrelas + comentário opcional)."""
    tenant = get_current_tenant()
    user_id = get_jwt_identity()
    claims = get_jwt()

    if not _is_student(claims):
        return jsonify({"error": "forbidden"}), 403

    lesson = Lesson.query.filter_by(
        id=lesson_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    schema = RatingSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    now = datetime.now(timezone.utc).isoformat()

    # Cria ou atualiza avaliação
    existing = LessonRating.query.filter_by(
        lesson_id=lesson_id,
        user_id=user_id,
        is_deleted=False,
    ).first()

    if existing:
        existing.rating = data["rating"]
        existing.comment = data.get("comment", existing.comment)
    else:
        existing = LessonRating(
            tenant_id=tenant.id,
            lesson_id=lesson_id,
            user_id=user_id,
            rating=data["rating"],
            comment=data.get("comment"),
        )
        db.session.add(existing)

    db.session.commit()

    # Verifica se deve gerar insight via Gemini (3+ avaliações ruins)
    _maybe_generate_insight(lesson_id, tenant.id)

    return jsonify({"message": "Avaliação registrada.", "rating": data["rating"]}), 200


@gamification_bp.route("/ratings/lessons/<string:lesson_id>/mine", methods=["GET"])
@jwt_required()
@require_tenant
def get_my_rating(lesson_id: str):
    """Retorna a avaliação do aluno logado para uma aula."""
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    rating = LessonRating.query.filter_by(
        lesson_id=lesson_id,
        user_id=user_id,
        is_deleted=False,
    ).first()

    if not rating:
        return jsonify({"rating": None}), 200

    return jsonify({"rating": {"stars": rating.rating, "comment": rating.comment}}), 200


@gamification_bp.route("/ratings/lessons/<string:lesson_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_lesson_ratings(lesson_id: str):
    """
    Produtor vê todas as avaliações de uma aula, com comentários e alunos.
    FIX: Retorna lesson_title, module_name, subject_name para o frontend saber
         a qual aula aquela avaliação pertence.
    """
    tenant = get_current_tenant()
    claims = get_jwt()

    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    lesson = Lesson.query.filter_by(
        id=lesson_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    # FIX: Busca metadados de localização da aula
    module = Module.query.get(lesson.module_id) if lesson.module_id else None
    subject = Subject.query.get(module.subject_id) if module else None

    ratings = (
        LessonRating.query.filter_by(
            lesson_id=lesson_id,
            is_deleted=False,
        )
        .order_by(LessonRating.created_at.desc())
        .all()
    )

    total = len(ratings)
    avg = round(sum(r.rating for r in ratings) / total, 2) if total else 0

    # Distribuição por estrela
    distribution = {i: 0 for i in range(1, 6)}
    for r in ratings:
        distribution[r.rating] += 1

    # AI insight (se gerado)
    ai_insight = next((r.ai_insight for r in ratings if r.ai_insight), None)

    return (
        jsonify(
            {
                "lesson_id": lesson_id,
                "lesson_title": lesson.title,
                "module_name": module.name if module else None,
                "subject_name": subject.name if subject else None,
                "avg_rating": avg,
                "total_ratings": total,
                "distribution": distribution,
                "ai_insight": ai_insight,
                "ratings": [
                    {
                        "id": r.id,
                        "stars": r.rating,
                        "comment": r.comment,
                        "created_at": (
                            r.created_at.isoformat() if r.created_at else None
                        ),
                        "student": {
                            "id": r.user.id if r.user else None,
                            "name": r.user.name if r.user else "Aluno",
                        },
                    }
                    for r in ratings
                ],
            }
        ),
        200,
    )


@gamification_bp.route("/ratings/producer/overview", methods=["GET"])
@jwt_required()
@require_tenant
def producer_ratings_overview():
    """
    Produtor vê ranking de aulas por avaliação média.
    FIX: Retorna module_name e subject_name para contextualizar cada aula
         na interface do produtor.
    """
    tenant = get_current_tenant()
    claims = get_jwt()

    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    # Busca todas as ratings do tenant
    all_ratings = LessonRating.query.filter_by(
        tenant_id=tenant.id,
        is_deleted=False,
    ).all()

    # Agrupa por aula
    by_lesson: dict = {}
    for r in all_ratings:
        lid = r.lesson_id
        if lid not in by_lesson:
            by_lesson[lid] = {"ratings": [], "ai_insight": None}
        by_lesson[lid]["ratings"].append(r.rating)
        if r.ai_insight:
            by_lesson[lid]["ai_insight"] = r.ai_insight

    result = []
    for lesson_id, data in by_lesson.items():
        lesson = Lesson.query.get(lesson_id)
        if not lesson or lesson.is_deleted:
            continue

        # FIX: Busca módulo e disciplina para contextualizar a aula
        module = Module.query.get(lesson.module_id) if lesson.module_id else None
        subject = Subject.query.get(module.subject_id) if module else None

        ratings = data["ratings"]
        avg = round(sum(ratings) / len(ratings), 2)
        low_count = sum(1 for r in ratings if r <= 2)
        result.append(
            {
                "lesson_id": lesson_id,
                "lesson_title": lesson.title,
                "module_name": module.name if module else None,
                "subject_name": subject.name if subject else None,
                "avg_rating": avg,
                "total_ratings": len(ratings),
                "low_ratings": low_count,
                "needs_attention": low_count >= 3,
                "ai_insight": data["ai_insight"],
            }
        )

    result.sort(key=lambda x: x["avg_rating"])

    return (
        jsonify(
            {
                "lessons": result,
                "total_rated": len(result),
                "needs_attention": [l for l in result if l["needs_attention"]],
            }
        ),
        200,
    )


# ── Geração de insight via Gemini ─────────────────────────────────────────────


def _maybe_generate_insight(lesson_id: str, tenant_id: str):
    """
    Se a aula tiver 3+ avaliações baixas (≤2 estrelas),
    gera insight via Gemini com base nos comentários.
    """
    ratings = LessonRating.query.filter_by(
        lesson_id=lesson_id,
        is_deleted=False,
    ).all()

    low_ratings = [r for r in ratings if r.rating <= 2]

    if len(low_ratings) < 3:
        return

    # Só gera se ainda não tem insight ou última versão é antiga
    latest_insight_version = max((r.ai_insight_version for r in ratings), default=0)
    if latest_insight_version >= len(low_ratings):
        return

    try:
        from app.services.gemini_service import GeminiService

        lesson = Lesson.query.get(lesson_id)
        if not lesson:
            return

        comments = [r.comment for r in low_ratings if r.comment]
        avg = round(sum(r.rating for r in ratings) / len(ratings), 2)

        svc = GeminiService()
        insight = svc.analyze_lesson_ratings(
            lesson_title=lesson.title,
            avg_rating=avg,
            low_count=len(low_ratings),
            total_count=len(ratings),
            comments=comments,
        )

        if insight:
            # Salva no primeiro registro de avaliação baixa
            low_ratings[0].ai_insight = insight
            low_ratings[0].ai_insight_version = len(low_ratings)
            db.session.commit()
    except Exception:
        pass  # Não falha o fluxo principal se Gemini falhar


# ══════════════════════════════════════════════════════════════════════════════
# MURAL DE HONRA — GAMIFICAÇÃO
# ══════════════════════════════════════════════════════════════════════════════


@gamification_bp.route("/hall-of-fame", methods=["GET"])
@jwt_required()
@require_tenant
def hall_of_fame():
    """
    Retorna o perfil de gamificação do aluno logado:
    - Patente atual e progresso para a próxima
    - Pontos totais
    - Badges conquistadas e não conquistadas
    - Novas badges (recém desbloqueadas)
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    engine = BadgeEngine(user_id=user_id, tenant_id=tenant.id)

    # Verifica novas conquistas
    new_badges = engine.check_and_award()

    # Perfil completo
    profile = engine.get_profile()
    profile["new_badges"] = [
        {**BADGES[key], "key": key} for key in new_badges if key in BADGES
    ]

    return jsonify(profile), 200


@gamification_bp.route("/hall-of-fame/check", methods=["POST"])
@jwt_required()
@require_tenant
def check_badges():
    """
    Dispara verificação de badges após uma ação do aluno.
    Retorna lista de novas badges conquistadas.
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    engine = BadgeEngine(user_id=user_id, tenant_id=tenant.id)
    new_badges = engine.check_and_award()

    return (
        jsonify(
            {
                "new_badges": [
                    {**BADGES[key], "key": key} for key in new_badges if key in BADGES
                ]
            }
        ),
        200,
    )
