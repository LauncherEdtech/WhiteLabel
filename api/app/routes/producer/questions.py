# api/app/routes/producer/questions.py
#
# Rotas do infoprodutor para submeter questões ao banco compartilhado.
#
# Fluxo de submissão:
#   1. Produtor envia questão → backend verifica duplicata por hash
#   2. Se duplicata: retorna 409 com dados da questão existente
#   3. Se nova: salva com review_status = PENDING e tenant_id = NULL
#   4. Admin recebe para aprovação
#   5. Aprovada: visível para todos com a feature
#   6. Rejeitada: produtor vê motivo no painel
# ─────────────────────────────────────────────────────────────────────────────

from uuid import uuid4

from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from marshmallow import Schema, ValidationError, fields, validate

from app.extensions import db
from app.middleware.tenant import require_tenant, require_feature
from app.models.question import (
    Alternative,
    DifficultyLevel,
    Question,
    QuestionSourceType,
    QuestionTag,
    QuestionType,
    ReviewStatus,
)
from app.models.user import UserRole

producer_questions_bp = Blueprint("producer_questions", __name__)


# ── Helpers de autorização ────────────────────────────────────────────────────


def _require_producer(claims: dict):
    if claims.get("role") not in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    ):
        return jsonify({"error": "forbidden", "message": "Acesso negado."}), 403
    return None


# ── Schemas ───────────────────────────────────────────────────────────────────


class AlternativeSchema(Schema):
    key = fields.Str(required=True, validate=validate.OneOf(["A", "B", "C", "D", "E"]))
    text = fields.Str(required=True, validate=validate.Length(min=1))
    distractor_justification = fields.Str(load_default=None)


class QuestionSubmitSchema(Schema):
    statement = fields.Str(required=True, validate=validate.Length(min=10))
    discipline = fields.Str(required=True)
    topic = fields.Str(load_default=None)
    subtopic = fields.Str(load_default=None)
    difficulty = fields.Str(
        load_default="medium",
        validate=validate.OneOf(["easy", "medium", "hard"]),
    )
    question_type = fields.Str(
        load_default=None,
        validate=validate.OneOf(
            ["interpretacao", "aplicacao", "raciocinio", "memorizacao"]
        ),
    )
    correct_alternative_key = fields.Str(
        required=True,
        validate=validate.OneOf(["A", "B", "C", "D", "E"]),
    )
    correct_justification = fields.Str(load_default=None)
    tip = fields.Str(load_default=None)
    exam_board = fields.Str(load_default=None)
    exam_year = fields.Int(load_default=None)
    exam_name = fields.Str(load_default=None)
    alternatives = fields.List(
        fields.Nested(AlternativeSchema),
        required=True,
        validate=validate.Length(min=2, max=5),
    )
    tags = fields.List(fields.Str(), load_default=list)


# ── Serializer ────────────────────────────────────────────────────────────────


def _serialize_question(q: Question, include_review: bool = False) -> dict:
    d = {
        "id": q.id,
        "statement": q.statement,
        "discipline": q.discipline,
        "topic": q.topic,
        "subtopic": q.subtopic,
        "difficulty": q.difficulty.value if q.difficulty else None,
        "question_type": q.question_type.value if q.question_type else None,
        "correct_alternative_key": q.correct_alternative_key,
        "correct_justification": q.correct_justification,
        "tip": q.tip,
        "exam_board": q.exam_board,
        "exam_year": q.exam_year,
        "exam_name": q.exam_name,
        "is_global": q.is_global,
        "accuracy_rate": q.accuracy_rate,
        "total_attempts": q.total_attempts,
        "alternatives": [
            {
                "key": a.key,
                "text": a.text,
                "distractor_justification": a.distractor_justification,
            }
            for a in q.alternatives
        ],
        "tags": [t.tag for t in q.tags],
        "created_at": q.created_at.isoformat() if q.created_at else None,
    }
    if include_review:
        d["review_status"] = q.review_status.value
        d["rejection_reason"] = q.rejection_reason
        d["reviewed_at"] = q.reviewed_at.isoformat() if q.reviewed_at else None
    return d


# ── Rotas ─────────────────────────────────────────────────────────────────────


@producer_questions_bp.route("/questions", methods=["GET"])
@jwt_required()
@require_tenant
@require_feature("question_bank_concursos")
def list_questions():
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = g.tenant
    discipline = request.args.get("discipline")
    topic = request.args.get("topic")
    difficulty = request.args.get("difficulty")
    q_type = request.args.get("question_type")
    review_status = request.args.get("review_status")
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)

    query = Question.query_for_tenant(tenant)

    if discipline:
        query = query.filter(Question.discipline.ilike(f"%{discipline}%"))
    if topic:
        query = query.filter(Question.topic.ilike(f"%{topic}%"))
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
    if q_type:
        query = query.filter(Question.question_type == q_type)
    if review_status:
        query = query.filter(Question.review_status == review_status)

    paginated = query.order_by(Question.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify(
        questions=[
            _serialize_question(q, include_review=True) for q in paginated.items
        ],
        total=paginated.total,
        page=page,
        pages=paginated.pages,
    )


@producer_questions_bp.route("/questions/submit", methods=["POST"])
@jwt_required()
@require_tenant
@require_feature("question_bank_concursos")
def submit_question():
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = g.tenant
    user_id = get_jwt_identity()

    try:
        data = QuestionSubmitSchema().load(request.get_json() or {})
    except ValidationError as e:
        return jsonify(error="Dados inválidos", details=e.messages), 400

    # ── Verificação de duplicata ──────────────────────────────────────────────
    duplicate = Question.find_duplicate(data["statement"])
    if duplicate:
        return (
            jsonify(
                error="Questão já existe no banco",
                code="DUPLICATE_QUESTION",
                existing={
                    "id": duplicate.id,
                    "discipline": duplicate.discipline,
                    "topic": duplicate.topic,
                    "statement": (
                        duplicate.statement[:200] + "..."
                        if len(duplicate.statement) > 200
                        else duplicate.statement
                    ),
                    "review_status": duplicate.review_status.value,
                },
            ),
            409,
        )

    alt_keys = {a["key"] for a in data["alternatives"]}
    if data["correct_alternative_key"] not in alt_keys:
        return (
            jsonify(
                error=f"Alternativa correta '{data['correct_alternative_key']}' "
                f"não está na lista de alternativas"
            ),
            400,
        )

    question = Question(
        id=str(uuid4()),
        tenant_id=None,
        source_type=QuestionSourceType.BANK,
        submitted_by_tenant_id=tenant.id,
        submitted_by_user_id=user_id,
        review_status=ReviewStatus.PENDING,
        statement=data["statement"],
        discipline=data["discipline"].strip().upper(),
        topic=data.get("topic"),
        subtopic=data.get("subtopic"),
        difficulty=data.get("difficulty", "medium"),
        question_type=data.get("question_type"),
        correct_alternative_key=data["correct_alternative_key"],
        correct_justification=data.get("correct_justification"),
        tip=data.get("tip"),
        exam_board=data.get("exam_board"),
        exam_year=data.get("exam_year"),
        exam_name=data.get("exam_name"),
    )

    db.session.add(question)
    db.session.flush()

    for alt_data in data["alternatives"]:
        db.session.add(
            Alternative(
                id=str(uuid4()),
                tenant_id=None,
                question_id=question.id,
                key=alt_data["key"],
                text=alt_data["text"],
                distractor_justification=alt_data.get("distractor_justification"),
            )
        )

    for tag_str in data.get("tags", []):
        tag_str = tag_str.strip().lower()
        if tag_str:
            db.session.add(
                QuestionTag(
                    id=str(uuid4()),
                    tenant_id=None,
                    question_id=question.id,
                    tag=tag_str,
                )
            )

    db.session.commit()

    return (
        jsonify(
            message="Questão enviada para revisão. Você será notificado quando o admin aprovar.",
            question=_serialize_question(question, include_review=True),
        ),
        201,
    )


@producer_questions_bp.route("/questions/<question_id>", methods=["GET"])
@jwt_required()
@require_tenant
@require_feature("question_bank_concursos")
def get_question(question_id):
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = g.tenant
    q = (
        Question.query_for_tenant(tenant)
        .filter(Question.id == question_id)
        .first_or_404()
    )

    return jsonify(_serialize_question(q, include_review=True))


@producer_questions_bp.route("/questions/submitted", methods=["GET"])
@jwt_required()
@require_tenant
@require_feature("question_bank_concursos")
def list_submitted():
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = g.tenant
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    status = request.args.get("review_status")

    query = db.session.query(Question).filter(
        Question.submitted_by_tenant_id == tenant.id
    )
    if status:
        query = query.filter(Question.review_status == status)

    paginated = query.order_by(Question.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    def _count(s):
        return (
            db.session.query(Question)
            .filter(
                Question.submitted_by_tenant_id == tenant.id,
                Question.review_status == s,
            )
            .count()
        )

    return jsonify(
        questions=[
            _serialize_question(q, include_review=True) for q in paginated.items
        ],
        total=paginated.total,
        page=page,
        pages=paginated.pages,
        summary={
            "pending": _count(ReviewStatus.PENDING),
            "approved": _count(ReviewStatus.APPROVED),
            "rejected": _count(ReviewStatus.REJECTED),
        },
    )
