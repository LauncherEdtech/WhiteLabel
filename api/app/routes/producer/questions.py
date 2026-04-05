# api/app/routes/producer/questions.py
#
# Rotas do infoprodutor para gerenciar questões do banco compartilhado.
#
# Fluxo de submissão:
#   1. Produtor envia questão → backend verifica duplicata por hash
#   2. Se duplicata: retorna 409 com dados da questão existente
#   3. Se nova: salva com review_status = PENDING e tenant_id = NULL
#   4. Admin recebe para aprovação
#   5. Aprovada: visível para todos com a feature
#   6. Rejeitada: produtor vê motivo no painel
# ─────────────────────────────────────────────────────────────────────────────

from datetime import datetime
from uuid import uuid4

from flask import Blueprint, g, jsonify, request
from marshmallow import Schema, ValidationError, fields, validate

from ...models.question import (
    Alternative,
    Question,
    QuestionAttempt,
    QuestionSourceType,
    QuestionTag,
    QuestionType,
    DifficultyLevel,
    ReviewStatus,
    compute_statement_hash,
)
from ...extensions import db
from ...decorators import producer_required, feature_required

producer_questions_bp = Blueprint("producer_questions", __name__)


# ── Schemas de validação ──────────────────────────────────────────────────────


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
@producer_required
@feature_required("question_bank_concursos")
def list_questions():
    """
    Lista questões visíveis para o produtor:
      - Banco global aprovado
      - Próprias questões submetidas (qualquer status)
    Suporta filtros: discipline, topic, difficulty, question_type,
                     review_status, page, per_page
    """
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
@producer_required
@feature_required("question_bank_concursos")
def submit_question():
    """
    Produtor submete uma questão para o banco global.

    Fluxo:
      1. Valida schema
      2. Verifica duplicata por statement_hash
      3. Salva com review_status = PENDING e tenant_id = NULL
      4. Retorna 201 ou 409 (duplicata)
    """
    tenant = g.tenant
    current_user = g.current_user

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

    # Valida se a alternativa correta está na lista
    alt_keys = {a["key"] for a in data["alternatives"]}
    if data["correct_alternative_key"] not in alt_keys:
        return (
            jsonify(
                error=f"Alternativa correta '{data['correct_alternative_key']}' "
                f"não está na lista de alternativas"
            ),
            400,
        )

    # ── Cria a questão ────────────────────────────────────────────────────────
    question = Question(
        id=str(uuid4()),
        tenant_id=None,  # Banco global — sem dono de tenant
        source_type=QuestionSourceType.BANK,
        # Rastreamento do produtor
        submitted_by_tenant_id=tenant.id,
        submitted_by_user_id=current_user.id,
        # Aguarda revisão do admin
        review_status=ReviewStatus.PENDING,
        # Dados pedagógicos
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
    # statement_hash é setado automaticamente via SQLAlchemy event

    db.session.add(question)
    db.session.flush()  # Obtém question.id antes de criar alternatives/tags

    # Alternativas
    for alt_data in data["alternatives"]:
        alt = Alternative(
            id=str(uuid4()),
            tenant_id=None,
            question_id=question.id,
            key=alt_data["key"],
            text=alt_data["text"],
            distractor_justification=alt_data.get("distractor_justification"),
        )
        db.session.add(alt)

    # Tags
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
@producer_required
@feature_required("question_bank_concursos")
def get_question(question_id):
    """Retorna questão visível para o tenant (banco global ou submetida por ele)."""
    tenant = g.tenant
    q = (
        Question.query_for_tenant(tenant)
        .filter(Question.id == question_id)
        .first_or_404()
    )
    return jsonify(_serialize_question(q, include_review=True))


@producer_questions_bp.route("/questions/submitted", methods=["GET"])
@producer_required
@feature_required("question_bank_concursos")
def list_submitted():
    """
    Lista APENAS as questões que este produtor submeteu,
    com seus respectivos statuses de revisão.
    """
    tenant = g.tenant
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    status = request.args.get("review_status")  # pending | approved | rejected

    query = db.session.query(Question).filter(
        Question.submitted_by_tenant_id == tenant.id
    )
    if status:
        query = query.filter(Question.review_status == status)

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
        summary={
            "pending": db.session.query(Question)
            .filter(
                Question.submitted_by_tenant_id == tenant.id,
                Question.review_status == ReviewStatus.PENDING,
            )
            .count(),
            "approved": db.session.query(Question)
            .filter(
                Question.submitted_by_tenant_id == tenant.id,
                Question.review_status == ReviewStatus.APPROVED,
            )
            .count(),
            "rejected": db.session.query(Question)
            .filter(
                Question.submitted_by_tenant_id == tenant.id,
                Question.review_status == ReviewStatus.REJECTED,
            )
            .count(),
        },
    )
