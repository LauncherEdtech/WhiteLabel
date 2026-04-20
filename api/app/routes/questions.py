# api/app/routes/questions.py
# Banco de questões com filtros avançados + registro de respostas com tempo.
# SEGURANÇA: Questões pertencem ao tenant — nunca visíveis entre produtores.
#
# ── SEPARAÇÃO DE TIPOS ────────────────────────────────────────────────────────
#   GET /questions/         → apenas source_type="bank" (nunca retorna questões de aula)
#   POST /questions/        → cria questão source_type="bank" + dispara análise Gemini
#   GET /lessons/:id/questions  → questões source_type="lesson" (em courses.py)
#   POST /lessons/:id/questions/generate → gera questões da aula via Gemini (em courses.py)
# ─────────────────────────────────────────────────────────────────────────────

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE
from sqlalchemy import and_, or_

from app.extensions import db, limiter
from app.models.question import (
    Question,
    Alternative,
    QuestionAttempt,
    DifficultyLevel,
    QuestionSourceType,
    ReviewStatus,
)
from app.models.course import Subject
from app.models.user import UserRole
from app.middleware.tenant import (
    resolve_tenant,
    require_tenant,
    require_feature,
    get_current_tenant,
)

questions_bp = Blueprint("questions", __name__)

# ── Helpers ───────────────────────────────────────────────────────────────────


def _is_producer_or_above(claims: dict) -> bool:
    return claims.get("role") in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    )


def _question_access_filter(tenant):
    """
    Filtro de acesso a questões levando em conta o banco global.
    Retorna condição SQLAlchemy que inclui questões próprias do tenant
    e, se a feature estiver ativa, as questões do banco global aprovadas.
    """
    own = and_(
        Question.tenant_id == tenant.id,
        Question.is_active == True,
        Question.is_deleted == False,
    )
    if tenant.is_feature_enabled("question_bank_concursos"):
        global_bank = and_(
            Question.tenant_id.is_(None),
            Question.source_type == QuestionSourceType.BANK,
            Question.review_status == "approved",
            Question.is_active == True,
        )
        return or_(own, global_bank)
    return own


# ── Schemas ───────────────────────────────────────────────────────────────────


class AlternativeSchema(Schema):
    key = fields.Str(required=True, validate=validate.OneOf(["a", "b", "c", "d", "e"]))
    text = fields.Str(required=True, validate=validate.Length(min=1))
    distractor_justification = fields.Str(allow_none=True, load_default=None)

    class Meta:
        unknown = EXCLUDE


class QuestionSchema(Schema):
    statement = fields.Str(required=True, validate=validate.Length(min=10))
    context = fields.Str(allow_none=True, load_default=None)
    subject_id = fields.Str(allow_none=True, load_default=None)
    discipline = fields.Str(allow_none=True, load_default=None)
    topic = fields.Str(allow_none=True, load_default=None)
    subtopic = fields.Str(allow_none=True, load_default=None)
    microtopic = fields.Str(allow_none=True, load_default=None)
    difficulty = fields.Str(
        load_default="medium",
        validate=validate.OneOf(["easy", "medium", "hard"]),
    )
    exam_board = fields.Str(allow_none=True, load_default=None)
    exam_year = fields.Int(
        allow_none=True, load_default=None, validate=validate.Range(min=1990, max=2030)
    )
    exam_name = fields.Str(allow_none=True, load_default=None)
    competency = fields.Str(allow_none=True, load_default=None)
    correct_alternative_key = fields.Str(
        required=True,
        validate=validate.OneOf(["a", "b", "c", "d", "e"]),
    )
    correct_justification = fields.Str(allow_none=True, load_default=None)
    alternatives = fields.List(
        fields.Nested(AlternativeSchema),
        required=True,
        validate=validate.Length(min=2, max=5),
    )

    class Meta:
        unknown = EXCLUDE


class AnswerSchema(Schema):
    """Aluno responde uma questão."""

    chosen_alternative_key = fields.Str(
        required=True,
        validate=validate.OneOf(["a", "b", "c", "d", "e", "A", "B", "C", "D", "E"]),
    )
    # Tempo de resposta em segundos — medido no frontend
    response_time_seconds = fields.Int(
        allow_none=True,
        load_default=None,
        validate=validate.Range(min=1, max=3600),
    )
    context = fields.Str(
        load_default="practice",
        validate=validate.OneOf(
            ["practice", "simulado", "schedule", "review", "lesson"]
        ),
    )

    class Meta:
        unknown = EXCLUDE


class QuestionFilterSchema(Schema):
    """Parâmetros de filtro para listagem de questões."""

    subject_id = fields.Str(load_default=None)
    discipline = fields.Str(load_default=None)
    topic = fields.Str(load_default=None)
    difficulty = fields.Str(
        load_default=None,
        validate=validate.OneOf(["easy", "medium", "hard", ""]),
    )
    exam_board = fields.Str(load_default=None)
    exam_year = fields.Int(load_default=None)
    # Filtros baseados no histórico do aluno
    previously_correct = fields.Bool(load_default=None)  # Apenas acertadas antes
    previously_wrong = fields.Bool(load_default=None)  # Apenas erradas antes
    not_answered = fields.Bool(load_default=None)  # Apenas não respondidas
    # Paginação
    page = fields.Int(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Int(load_default=20, validate=validate.Range(min=1, max=100))

    class Meta:
        unknown = EXCLUDE


# ── Before request ────────────────────────────────────────────────────────────


@questions_bp.before_request
def before_request():
    resolve_tenant()


# ══════════════════════════════════════════════════════════════════════════════
# LISTAGEM COM FILTROS — apenas questões do banco (source_type="bank")
# ══════════════════════════════════════════════════════════════════════════════


@questions_bp.route("/", methods=["GET"])
@jwt_required()
@require_tenant
def list_questions():
    """
    Lista questões do banco de concursos com filtros avançados.

    IMPORTANTE: Retorna APENAS questões source_type="bank" (enviadas pelo produtor).
    Questões de aula (source_type="lesson") são acessadas via GET /lessons/:id/questions.

    Filtros disponíveis (query params):
    - subject_id, discipline, topic, difficulty
    - exam_board, exam_year
    - previously_correct, previously_wrong, not_answered
    - page, per_page

    SEGURANÇA: Filtra sempre por tenant_id.
    Aluno nunca vê questões de outro produtor.
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()
    claims = get_jwt()

    schema = QuestionFilterSchema()
    try:
        filters = schema.load(request.args)
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    # ── Query base: questões do banco visíveis para este tenant ──────────────
    # Sempre inclui questões próprias (tenant_id = tenant.id, source_type = bank)
    # Se feature question_bank_concursos habilitada: inclui também o banco global
    # (tenant_id IS NULL, source_type = bank, review_status = approved)
    own_bank = and_(
        Question.tenant_id == tenant.id,
        Question.source_type == QuestionSourceType.BANK,
        Question.is_active == True,
        Question.is_deleted == False,
    )

    if tenant.is_feature_enabled("question_bank_concursos"):
        global_bank = and_(
            Question.tenant_id.is_(None),
            Question.source_type == QuestionSourceType.BANK,
            Question.review_status == "approved",
            Question.is_active == True,
        )
        query = Question.query.filter(or_(own_bank, global_bank))
    else:
        query = Question.query.filter(own_bank)

    # ── Filtros de metadados ──────────────────────────────────────────────────
    if filters.get("subject_id"):
        query = query.filter(Question.subject_id == filters["subject_id"])

    if filters.get("discipline"):
        query = query.filter(Question.discipline.ilike(f"%{filters['discipline']}%"))

    if filters.get("topic"):
        query = query.filter(Question.topic.ilike(f"%{filters['topic']}%"))

    if filters.get("difficulty"):
        query = query.filter(Question.difficulty == filters["difficulty"])

    if filters.get("exam_board"):
        query = query.filter(Question.exam_board.ilike(f"%{filters['exam_board']}%"))

    if filters.get("exam_year"):
        query = query.filter(Question.exam_year == filters["exam_year"])

    # ── Filtros baseados no histórico do aluno ────────────────────────────────
    if filters.get("previously_correct") is True:
        correct_ids = (
            db.session.query(QuestionAttempt.question_id)
            .filter_by(
                user_id=user_id,
                tenant_id=tenant.id,
                is_correct=True,
                is_deleted=False,
            )
            .distinct()
        )
        query = query.filter(Question.id.in_(correct_ids))

    elif filters.get("previously_wrong") is True:
        wrong_ids = (
            db.session.query(QuestionAttempt.question_id)
            .filter_by(
                user_id=user_id,
                tenant_id=tenant.id,
                is_correct=False,
                is_deleted=False,
            )
            .distinct()
        )
        never_correct_ids = (
            db.session.query(QuestionAttempt.question_id)
            .filter_by(
                user_id=user_id,
                tenant_id=tenant.id,
                is_correct=True,
                is_deleted=False,
            )
            .distinct()
        )
        query = query.filter(
            Question.id.in_(wrong_ids),
            Question.id.notin_(never_correct_ids),
        )

    elif filters.get("not_answered") is True:
        answered_ids = (
            db.session.query(QuestionAttempt.question_id)
            .filter_by(
                user_id=user_id,
                tenant_id=tenant.id,
                is_deleted=False,
            )
            .distinct()
        )
        query = query.filter(Question.id.notin_(answered_ids))

    # ── Paginação ─────────────────────────────────────────────────────────────
    page = filters["page"]
    per_page = filters["per_page"]
    total = query.count()

    questions = query.order_by(Question.created_at.desc()).paginate(
        page=page,
        per_page=per_page,
        error_out=False,
    )

    attempt_map = _get_last_attempts_map(
        user_id, tenant.id, [q.id for q in questions.items]
    )

    return (
        jsonify(
            {
                "questions": [
                    _serialize_question(q, attempt_map.get(q.id), include_answer=False)
                    for q in questions.items
                ],
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "pages": questions.pages,
                    "has_next": questions.has_next,
                    "has_prev": questions.has_prev,
                },
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# CRUD DE QUESTÕES (produtor) — sempre source_type="bank"
# ══════════════════════════════════════════════════════════════════════════════


@questions_bp.route("/", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("100 per hour")
def create_question():
    """
    Cria questão manualmente no banco de concursos.
    Sempre cria como source_type="bank".
    Dispara análise automática via Gemini se metadados incompletos.
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()

    schema = QuestionSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    # SEGURANÇA: Valida que subject_id pertence ao tenant
    if data.get("subject_id"):
        subject = Subject.query.filter_by(
            id=data["subject_id"],
            tenant_id=tenant.id,
            is_deleted=False,
        ).first()
        if not subject:
            return jsonify({"error": "subject_not_found"}), 404

    question = Question(
        tenant_id=tenant.id,
        source_type=QuestionSourceType.BANK,  # ← sempre bank quando criada pelo produtor
        lesson_id=None,  # ← nunca vinculada a aula aqui
        subject_id=data.get("subject_id"),
        statement=data["statement"],
        context=data.get("context"),
        discipline=data.get("discipline"),
        topic=data.get("topic"),
        subtopic=data.get("subtopic"),
        microtopic=data.get("microtopic"),
        difficulty=DifficultyLevel(data["difficulty"]),
        exam_board=data.get("exam_board"),
        exam_year=data.get("exam_year"),
        exam_name=data.get("exam_name"),
        competency=data.get("competency"),
        correct_alternative_key=data["correct_alternative_key"],
        correct_justification=data.get("correct_justification"),
        is_active=True,
        is_reviewed=True,  # Marcada como revisada — foi o produtor que criou
    )
    db.session.add(question)
    db.session.flush()

    # Cria as alternativas
    for alt_data in data["alternatives"]:
        alt = Alternative(
            tenant_id=tenant.id,
            question_id=question.id,
            key=alt_data["key"],
            text=alt_data["text"],
            distractor_justification=alt_data.get("distractor_justification"),
        )
        db.session.add(alt)

    db.session.commit()

    # ── Dispara análise Gemini se metadados incompletos ───────────────────────
    # Se o produtor não preencheu disciplina/tópico/dificuldade, o Gemini preenche
    _needs_analysis = not data.get("discipline") or not data.get("topic")
    if _needs_analysis:
        try:
            from app.tasks import analyze_question_task

            analyze_question_task.delay(question.id, tenant.id)
        except Exception:
            pass  # Falha no Celery não bloqueia a criação da questão

    return (
        jsonify(
            {
                "message": "Questão criada.",
                "question": _serialize_question(question, include_answer=True),
            }
        ),
        201,
    )


@questions_bp.route("/<string:question_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_question(question_id: str):
    """
    Retorna questão completa com alternativas.
    Aluno: NÃO recebe gabarito nem justificativas (isso vem apenas após responder).
    Produtor: recebe tudo.

    SEGURANÇA: Questões de aula (source_type="lesson") também são acessíveis aqui
    desde que o aluno tenha acesso ao tenant — o isolamento é feito pela lesson_id
    na listagem, não no GET individual.
    """
    tenant = get_current_tenant()
    claims = get_jwt()
    user_id = get_jwt_identity()

    question = Question.query.filter(
        Question.id == question_id,
        _question_access_filter(tenant),
    ).first()
    if not question:
        return jsonify({"error": "not_found"}), 404

    is_producer = _is_producer_or_above(claims)

    last_attempt = (
        QuestionAttempt.query.filter_by(
            question_id=question.id,
            user_id=user_id,
            tenant_id=tenant.id,
            is_deleted=False,
        )
        .order_by(QuestionAttempt.created_at.desc())
        .first()
        if not is_producer
        else None
    )

    show_answer = is_producer or (last_attempt is not None)

    return (
        jsonify(
            {
                "question": _serialize_question(
                    question, last_attempt, include_answer=show_answer
                )
            }
        ),
        200,
    )


@questions_bp.route("/<string:question_id>", methods=["PUT"])
@jwt_required()
@require_tenant
def update_question(question_id: str):
    """Atualiza questão. Apenas produtor."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    question = Question.query.filter_by(
        id=question_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not question:
        return jsonify({"error": "not_found"}), 404

    schema = QuestionSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    question.statement = data["statement"]
    question.context = data.get("context", question.context)
    question.discipline = data.get("discipline", question.discipline)
    question.topic = data.get("topic", question.topic)
    question.subtopic = data.get("subtopic", question.subtopic)
    question.microtopic = data.get("microtopic", question.microtopic)
    question.difficulty = DifficultyLevel(data["difficulty"])
    question.exam_board = data.get("exam_board", question.exam_board)
    question.exam_year = data.get("exam_year", question.exam_year)
    question.exam_name = data.get("exam_name", question.exam_name)
    question.competency = data.get("competency", question.competency)
    question.correct_alternative_key = data["correct_alternative_key"]
    question.correct_justification = data.get(
        "correct_justification", question.correct_justification
    )
    question.is_reviewed = True

    # Recria alternativas
    for alt in question.alternatives:
        db.session.delete(alt)
    db.session.flush()

    for alt_data in data["alternatives"]:
        alt = Alternative(
            tenant_id=tenant.id,
            question_id=question.id,
            key=alt_data["key"],
            text=alt_data["text"],
            distractor_justification=alt_data.get("distractor_justification"),
        )
        db.session.add(alt)

    db.session.commit()

    return (
        jsonify(
            {
                "message": "Questão atualizada.",
                "question": _serialize_question(question, include_answer=True),
            }
        ),
        200,
    )


@questions_bp.route("/<string:question_id>", methods=["DELETE"])
@jwt_required()
@require_tenant
def delete_question(question_id: str):
    """Soft delete de questão. Apenas produtor."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    question = Question.query.filter_by(
        id=question_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not question:
        return jsonify({"error": "not_found"}), 404

    question.is_deleted = True
    question.is_active = False
    db.session.commit()

    return jsonify({"message": "Questão removida."}), 200


# ══════════════════════════════════════════════════════════════════════════════
# RESPONDER QUESTÃO (aluno)
# ══════════════════════════════════════════════════════════════════════════════


@questions_bp.route("/<string:question_id>/answer", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("200 per hour")
def answer_question(question_id: str):
    """
    Aluno responde uma questão.
    Retorna: se acertou, gabarito, justificativas, XP ganho.
    Funciona para questões de banco E questões de aula.
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    question = Question.query.filter(
        Question.id == question_id,
        _question_access_filter(tenant),
    ).first()
    if not question:
        return jsonify({"error": "not_found"}), 404

    schema = AnswerSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400
    # Normaliza para maiúsculo — banco global usa A-E, questões antigas usam a-e
    chosen_key = data["chosen_alternative_key"].upper()
    is_correct = chosen_key == question.correct_alternative_key.upper()
    context = data.get("context", "practice")

    # Upsert: se já existe tentativa para este (user, question, context), atualiza
    existing_attempt = QuestionAttempt.query.filter_by(
        user_id=user_id,
        question_id=question.id,
        tenant_id=tenant.id,
        context=context,
        is_deleted=False,
    ).first()

    is_new_attempt = existing_attempt is None

    if existing_attempt:
        existing_attempt.chosen_alternative_key = chosen_key
        existing_attempt.is_correct = is_correct
        existing_attempt.response_time_seconds = data.get("response_time_seconds")
        existing_attempt.created_at = datetime.now(timezone.utc)
        attempt = existing_attempt
    else:
        attempt = QuestionAttempt(
            tenant_id=tenant.id,
            user_id=user_id,
            question_id=question.id,
            chosen_alternative_key=chosen_key,
            is_correct=is_correct,
            response_time_seconds=data.get("response_time_seconds"),
            context=context,
        )
        db.session.add(attempt)

    # Atualiza stats apenas em novas tentativas (evita inflacionar contadores)
    if is_new_attempt:
        question.total_attempts += 1
        if is_correct:
            question.correct_attempts += 1

    db.session.commit()

    try:
        from app.routes.analytics import _cache_delete, _dashboard_cache_key
        _cache_delete(_dashboard_cache_key(user_id, tenant.id))
        _cache_delete(f"next_action:{tenant.id}:{user_id}")
    except Exception:
        pass

    # Monta resposta com justificativas
    alternatives_with_feedback = []
    for alt in sorted(question.alternatives, key=lambda a: a.key):
        alt_data = {
            "key": alt.key,
            "text": alt.text,
            "is_correct": alt.key == question.correct_alternative_key,
            "is_chosen": alt.key == chosen_key,
        }
        if alt.key == question.correct_alternative_key:
            alt_data["justification"] = question.correct_justification
        elif alt.distractor_justification:
            alt_data["justification"] = alt.distractor_justification
        alternatives_with_feedback.append(alt_data)

    xp_gained = 10 if is_correct else 2

    # Dispara atualização de gamificação via Celery (não bloqueia a resposta)
    try:
        from app.tasks import update_gamification_after_answer

        update_gamification_after_answer.delay(
            user_id, tenant.id, is_correct, xp_gained
        )
    except Exception:
        pass

    # Dispara adaptação do cronograma se a questão pertence a uma disciplina
    # Threshold: >= 10 tentativas e acurácia < 50% → injeta revisões extras
    # Se acurácia >= 70% → remove revisões adaptativas pendentes
    try:
        if question.subject_id:
            from app.tasks.schedule_tasks import adapt_after_question_attempt

            adapt_after_question_attempt.delay(
                user_id=user_id,
                tenant_id=tenant.id,
                subject_id=question.subject_id,
            )
    except Exception:
        pass  # Nunca falha a resposta da questão por causa do cronograma

    return (
        jsonify(
            {
                "is_correct": is_correct,
                "chosen_key": chosen_key,
                "correct_key": question.correct_alternative_key,
                "xp_gained": xp_gained,
                "alternatives": alternatives_with_feedback,
                "attempt_id": attempt.id,
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# HISTÓRICO DO ALUNO
# ══════════════════════════════════════════════════════════════════════════════


@questions_bp.route("/my-history", methods=["GET"])
@jwt_required()
@require_tenant
def my_history():
    """Histórico de tentativas do aluno agrupado por disciplina."""
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    attempts = (
        QuestionAttempt.query.filter_by(
            user_id=user_id,
            tenant_id=tenant.id,
            is_deleted=False,
        )
        .order_by(QuestionAttempt.created_at.desc())
        .limit(200)
        .all()
    )

    by_discipline = {}
    for attempt in attempts:
        question = attempt.question
        if not question:
            continue
        discipline = question.discipline or "Sem disciplina"
        if discipline not in by_discipline:
            by_discipline[discipline] = {"total": 0, "correct": 0, "wrong": 0}
        by_discipline[discipline]["total"] += 1
        if attempt.is_correct:
            by_discipline[discipline]["correct"] += 1
        else:
            by_discipline[discipline]["wrong"] += 1

    for disc in by_discipline:
        total = by_discipline[disc]["total"]
        correct = by_discipline[disc]["correct"]
        by_discipline[disc]["accuracy_rate"] = (
            round((correct / total) * 100, 1) if total else 0
        )

    total_attempts = len(attempts)
    total_correct = sum(1 for a in attempts if a.is_correct)

    return (
        jsonify(
            {
                "summary": {
                    "total_answered": total_attempts,
                    "total_correct": total_correct,
                    "total_wrong": total_attempts - total_correct,
                    "overall_accuracy": (
                        round((total_correct / total_attempts) * 100, 1)
                        if total_attempts
                        else 0
                    ),
                },
                "by_discipline": by_discipline,
            }
        ),
        200,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_last_attempts_map(user_id: str, tenant_id: str, question_ids: list) -> dict:
    """
    Retorna a última tentativa de cada questão para o aluno atual.
    Usado para mostrar status (acertou/errou) na listagem.
    """
    if not question_ids:
        return {}

    attempts = (
        QuestionAttempt.query.filter(
            QuestionAttempt.user_id == user_id,
            QuestionAttempt.tenant_id == tenant_id,
            QuestionAttempt.question_id.in_(question_ids),
            QuestionAttempt.is_deleted == False,
        )
        .order_by(QuestionAttempt.created_at.desc())
        .all()
    )

    attempt_map = {}
    for attempt in attempts:
        if attempt.question_id not in attempt_map:
            attempt_map[attempt.question_id] = attempt
    return attempt_map


def _serialize_question(
    question: Question, last_attempt=None, include_answer: bool = False
) -> dict:
    """
    Serializa questão.
    SEGURANÇA: include_answer=False oculta gabarito para alunos
    que ainda não responderam — evita que vejam a resposta antes.
    """
    alternatives = []
    for alt in sorted(question.alternatives, key=lambda a: a.key):
        alt_data = {
            "key": alt.key,
            "text": alt.text,
        }
        if include_answer:
            alt_data["distractor_justification"] = alt.distractor_justification
        alternatives.append(alt_data)

    data = {
        "id": question.id,
        "source_type": question.source_type.value if question.source_type else "bank",
        "lesson_id": question.lesson_id,
        "statement": question.statement,
        "context": question.context,
        "discipline": question.discipline,
        "topic": question.topic,
        "subtopic": question.subtopic,
        "tip": question.tip,
        "difficulty": question.difficulty.value if question.difficulty else None,
        "exam_board": question.exam_board,
        "exam_year": question.exam_year,
        "exam_name": question.exam_name,
        "competency": question.competency,
        "is_reviewed": question.is_reviewed,
        "alternatives": alternatives,
        "stats": {
            "total_attempts": question.total_attempts,
            "accuracy_rate": round(question.accuracy_rate * 100, 1),
            "avg_response_time_seconds": round(
                question.avg_response_time_seconds or 0, 1
            ),
        },
        "my_status": {
            "answered": last_attempt is not None,
            "is_correct": last_attempt.is_correct if last_attempt else None,
            "chosen_key": last_attempt.chosen_alternative_key if last_attempt else None,
        },
    }

    if include_answer:
        data["correct_alternative_key"] = question.correct_alternative_key
        data["correct_justification"] = question.correct_justification

    return data


# ── Pipeline Gemini — Importação de questões de concurso (source_type="bank") ──


@questions_bp.route("/disciplines", methods=["GET"])
@jwt_required()
@require_tenant
def get_disciplines():
    """Retorna disciplinas disponíveis para este tenant (inclui banco global se feature ativa)."""
    tenant = get_current_tenant()
    condition = _question_access_filter(tenant)
    rows = (
        db.session.query(Question.discipline)
        .filter(condition, Question.discipline.isnot(None))
        .distinct()
        .order_by(Question.discipline)
        .all()
    )
    return jsonify(disciplines=[r[0] for r in rows])


@questions_bp.route("/topics", methods=["GET"])
@jwt_required()
@require_tenant
def get_topics():
    """Retorna tópicos de uma disciplina específica."""
    tenant = get_current_tenant()
    discipline = request.args.get("discipline", "").strip()
    if not discipline:
        return jsonify(topics=[])
    condition = _question_access_filter(tenant)
    rows = (
        db.session.query(Question.topic)
        .filter(
            condition,
            Question.discipline.ilike(f"%{discipline}%"),
            Question.topic.isnot(None),
        )
        .distinct()
        .order_by(Question.topic)
        .all()
    )
    return jsonify(topics=[r[0] for r in rows])


@questions_bp.route("/count", methods=["GET"])
@jwt_required()
@require_tenant
def get_count():
    """Retorna total de questões disponíveis com os filtros aplicados."""
    tenant = get_current_tenant()
    schema = QuestionFilterSchema()
    try:
        filters = schema.load(request.args)
    except ValidationError:
        return jsonify(total=0)

    condition = _question_access_filter(tenant)
    query = Question.query.filter(condition)
    if filters.get("discipline"):
        query = query.filter(Question.discipline.ilike(f"%{filters['discipline']}%"))
    if filters.get("topic"):
        query = query.filter(Question.topic.ilike(f"%{filters['topic']}%"))
    if filters.get("difficulty"):
        query = query.filter(Question.difficulty == filters["difficulty"])
    return jsonify(total=query.count())


@questions_bp.route("/extract-text", methods=["POST"])
@jwt_required()
@require_tenant
@require_feature("ai_features")
def extract_questions_from_text():
    """
    Extrai questões de concurso de um texto via Gemini.
    As questões extraídas são source_type="bank" — vão para o banco geral.
    """
    data = request.get_json() or {}
    context = data.get("context", "").strip()

    if not context or len(context) < 50:
        return (
            jsonify(
                {
                    "error": "bad_request",
                    "message": "Forneça pelo menos 50 caracteres de contexto.",
                }
            ),
            400,
        )

    from app.services.gemini_service import GeminiService

    svc = GeminiService()
    questions = svc.extract_questions(context)

    return jsonify({"questions": questions, "total": len(questions)}), 200


@questions_bp.route("/extract", methods=["POST"])
@jwt_required()
@require_tenant
@require_feature("ai_features")
def extract_questions_from_file():
    """
    Extrai questões de concurso de PDF/arquivo via Gemini.
    As questões extraídas são source_type="bank" — vão para o banco geral.
    """
    if "file" not in request.files:
        return jsonify({"error": "bad_request", "message": "Arquivo não enviado."}), 400

    file = request.files["file"]
    context_hint = request.form.get("context", "")

    content = file.read()
    filename = file.filename or ""

    if filename.lower().endswith(".pdf"):
        try:
            import io
            import pypdf

            reader = pypdf.PdfReader(io.BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return (
                jsonify(
                    {"error": "bad_request", "message": "Não foi possível ler o PDF."}
                ),
                400,
            )
    else:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1")

    if len(text.strip()) < 50:
        return (
            jsonify(
                {"error": "bad_request", "message": "Arquivo sem conteúdo suficiente."}
            ),
            400,
        )

    from app.services.gemini_service import GeminiService

    svc = GeminiService()
    questions = svc.extract_questions(text[:15000])

    return jsonify({"questions": questions, "total": len(questions)}), 200
