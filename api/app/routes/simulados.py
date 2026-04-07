# api/app/routes/simulados.py
# Simulados: provas completas com timer, respostas e feedback detalhado.
#
# Fluxo completo:
# 1. Produtor cria template do simulado (ou IA gera automaticamente)
# 2. Aluno inicia tentativa → timer começa server-side
# 3. Aluno responde questões individualmente (salva parcialmente)
# 4. Aluno finaliza OU timer expira → score calculado
# 5. Feedback completo: score geral + por disciplina + gabarito
#
# SEGURANÇA:
# - Timer validado server-side (não confia no cliente)
# - Gabarito só liberado após finalização
# - Tentativa em andamento não pode ser reiniciada

from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE
from sqlalchemy import func

from app.extensions import db, limiter
from app.models.user import User, UserRole
from app.models.question import Question, Alternative, QuestionAttempt, DifficultyLevel
from app.models.simulado import (
    Simulado,
    SimuladoQuestion,
    SimuladoAttempt,
    SimuladoAnswer,
)
from app.models.course import Subject, CourseEnrollment
from app.middleware.tenant import (
    resolve_tenant,
    require_tenant,
    require_feature,
    get_current_tenant,
)

simulados_bp = Blueprint("simulados", __name__)

# ── Helpers ───────────────────────────────────────────────────────────────────


def _is_producer_or_above(claims: dict) -> bool:
    return claims.get("role") in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    )


def _get_simulado_or_404(simulado_id: str, tenant_id: str):
    return Simulado.query.filter_by(
        id=simulado_id,
        tenant_id=tenant_id,
        is_deleted=False,
    ).first()


# ── Schemas ───────────────────────────────────────────────────────────────────


class CreateSimuladoSchema(Schema):
    course_id = fields.Str(required=True)
    title = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    description = fields.Str(allow_none=True, load_default=None)
    time_limit_minutes = fields.Int(
        required=True,
        validate=validate.Range(min=10, max=480),  # 10min a 8h
    )
    question_ids = fields.List(
        fields.Str(),
        load_default=None,
        allow_none=True,
    )
    # Geração automática por filtros (alternativa ao question_ids manual)
    auto_generate = fields.Bool(load_default=False)
    auto_filters = fields.Dict(load_default=None, allow_none=True)
    # Ex: {"discipline": "Direito Penal", "difficulty": "medium", "count": 20}

    settings = fields.Dict(load_default=None, allow_none=True)

    class Meta:
        unknown = EXCLUDE


class AnswerQuestionSchema(Schema):
    """Resposta do aluno a uma questão durante o simulado."""

    question_id = fields.Str(required=True)
    chosen_alternative_key = fields.Str(
        allow_none=True,  # None = pulou a questão
        load_default=None,
        validate=validate.OneOf(["a", "b", "c", "d", "e", "A", "B", "C", "D", "E"]),
    )
    response_time_seconds = fields.Int(
        allow_none=True,
        load_default=None,
        validate=validate.Range(min=1, max=7200),
    )

    class Meta:
        unknown = EXCLUDE


# ── Before request ────────────────────────────────────────────────────────────


@simulados_bp.before_request
def before_request():
    resolve_tenant()


# ══════════════════════════════════════════════════════════════════════════════
# CRUD DE SIMULADOS (produtor)
# ══════════════════════════════════════════════════════════════════════════════


@simulados_bp.route("/", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("20 per hour")
def create_simulado():
    """
    Cria um simulado.
    Modos:
    A) Manual: produtor passa question_ids específicos
    B) Auto: sistema seleciona questões por filtros (discipline, difficulty, count)
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()

    schema = CreateSimuladoSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    settings = data.get("settings") or {
        "shuffle_questions": True,
        "shuffle_alternatives": False,
        "show_result_immediately": True,
        "passing_score": 0.6,
    }

    simulado = Simulado(
        tenant_id=tenant.id,
        course_id=data["course_id"],
        title=data["title"],
        description=data.get("description"),
        time_limit_minutes=data["time_limit_minutes"],
        settings=settings,
        is_active=True,
        is_ai_generated=data["auto_generate"],
    )
    db.session.add(simulado)
    db.session.flush()

    # ── Seleciona questões ────────────────────────────────────────────────────
    if data["auto_generate"] and data.get("auto_filters"):
        question_ids = _auto_select_questions(tenant.id, data["auto_filters"])
    elif data.get("question_ids"):
        question_ids = data["question_ids"]
    else:
        return (
            jsonify(
                {
                    "error": "questions_required",
                    "message": "Informe question_ids ou use auto_generate com auto_filters.",
                }
            ),
            400,
        )

    if not question_ids:
        return (
            jsonify(
                {
                    "error": "no_questions",
                    "message": "Nenhuma questão encontrada com os filtros informados.",
                }
            ),
            400,
        )

    # Valida que questões pertencem ao tenant e adiciona ao simulado
    added = 0
    for order, qid in enumerate(question_ids):
        from sqlalchemy import or_

        question = Question.query.filter(
            Question.id == qid,
            Question.is_active == True,
            or_(
                Question.tenant_id == tenant.id,
                Question.tenant_id.is_(None),
            ),
        ).first()
        if question:
            sq = SimuladoQuestion(
                tenant_id=tenant.id,
                simulado_id=simulado.id,
                question_id=question.id,
                order=order,
            )
            db.session.add(sq)
            added += 1

    if added == 0:
        db.session.rollback()
        return jsonify({"error": "no_valid_questions"}), 400

    db.session.commit()

    return (
        jsonify(
            {
                "message": "Simulado criado com sucesso.",
                "simulado": _serialize_simulado(simulado, total_questions=added),
            }
        ),
        201,
    )


@simulados_bp.route("/auto-generate", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("10 per hour")
def auto_generate_simulado():
    """
    Cria simulado. Dois modos:

    FIXO (question_filter = "all"):
      Questões selecionadas agora e salvas em SimuladoQuestion.
      Todos os alunos veem as mesmas questões.

    PERSONALIZADO (question_filter != "all"):
      Questões selecionadas por aluno no momento que ele inicia.
      settings guarda a configuração; SimuladoQuestion fica vazio.
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    body = request.get_json(force=True) or {}

    course_id = body.get("course_id")
    title = body.get("title", f"Simulado — {datetime.now().strftime('%d/%m/%Y')}")
    time_limit = body.get("time_limit_minutes", 60)
    difficulty = body.get("difficulty") or None
    question_filter = body.get("question_filter", "all")
    disciplines_raw = body.get(
        "disciplines"
    )  # "all" | None | [{discipline,topic?,count}]

    VALID_FILTERS = {"all", "not_answered", "previously_correct", "previously_wrong"}
    if question_filter not in VALID_FILTERS:
        question_filter = "all"

    # Normaliza disciplines
    if disciplines_raw == "all" or not disciplines_raw:
        disciplines_list = None  # sem restrição → pool geral
    elif isinstance(disciplines_raw, list):
        disciplines_list = [
            {
                "discipline": d.get("discipline", "").strip(),
                "topic": d.get("topic", "").strip() or None,
                "count": min(int(d.get("count", 10)), 50),
            }
            for d in disciplines_raw
            if d.get("discipline", "").strip()
        ]
    else:
        disciplines_list = None

    # Total de questões
    if disciplines_list:
        total_requested = sum(d["count"] for d in disciplines_list)
        if total_requested > 100:
            return (
                jsonify(
                    {
                        "error": "too_many_questions",
                        "message": "Limite máximo de 100 questões por simulado.",
                    }
                ),
                400,
            )
    else:
        total_requested = min(int(body.get("total_questions", 20)), 100)

    # ── Simulado PERSONALIZADO: cria template vazio ───────────────────────────
    if question_filter != "all":
        simulado = Simulado(
            tenant_id=tenant.id,
            course_id=course_id,
            title=title,
            time_limit_minutes=time_limit,
            settings={
                "shuffle_questions": True,
                "shuffle_alternatives": False,
                "show_result_immediately": True,
                "passing_score": 0.6,
                "question_filter": question_filter,
                "total_questions": total_requested,
                "difficulty": difficulty,
                "disciplines": disciplines_list,
            },
            is_active=True,
            is_ai_generated=True,
        )
        db.session.add(simulado)
        db.session.commit()

        filter_label = {
            "not_answered": "Não respondidas",
            "previously_correct": "Acertadas antes",
            "previously_wrong": "Erradas antes",
        }.get(question_filter, question_filter)

        return (
            jsonify(
                {
                    "message": (
                        f"Simulado personalizado criado ({filter_label}). "
                        f"Cada aluno receberá {total_requested} questões baseadas no seu histórico."
                    ),
                    "simulado": _serialize_simulado(
                        simulado, total_questions=total_requested
                    ),
                }
            ),
            201,
        )

    # ── Simulado FIXO: seleciona questões agora ───────────────────────────────
    question_ids: list = []
    blocks_without_questions: list = []

    if disciplines_list:
        for block in disciplines_list:
            ids = _auto_select_questions(
                tenant.id,
                {
                    "count": block["count"],
                    "discipline": block["discipline"],
                    "topic": block.get("topic"),
                    "difficulty": difficulty,
                },
            )
            if not ids:
                blocks_without_questions.append(block["discipline"])
            else:
                new = [qid for qid in ids if qid not in question_ids]
                question_ids.extend(new)
    else:
        question_ids = _auto_select_questions(
            tenant.id,
            {
                "count": total_requested,
                "difficulty": difficulty,
            },
        )

    if not question_ids:
        return (
            jsonify(
                {
                    "error": "no_questions",
                    "message": "Não há questões suficientes com os critérios informados.",
                }
            ),
            400,
        )

    simulado = Simulado(
        tenant_id=tenant.id,
        course_id=course_id,
        title=title,
        time_limit_minutes=time_limit,
        settings={
            "shuffle_questions": True,
            "shuffle_alternatives": False,
            "show_result_immediately": True,
            "passing_score": 0.6,
            "question_filter": "all",
            "disciplines": disciplines_list,
        },
        is_active=True,
        is_ai_generated=True,
    )
    db.session.add(simulado)
    db.session.flush()

    for order, qid in enumerate(question_ids):
        db.session.add(
            SimuladoQuestion(
                tenant_id=tenant.id,
                simulado_id=simulado.id,
                question_id=qid,
                order=order,
            )
        )

    db.session.commit()

    response = {
        "message": f"Simulado criado com {len(question_ids)} questões.",
        "simulado": _serialize_simulado(simulado, total_questions=len(question_ids)),
    }
    if blocks_without_questions:
        response["warnings"] = [f"Sem questões: {d}" for d in blocks_without_questions]
    return jsonify(response), 201


@simulados_bp.route("/", methods=["GET"])
@jwt_required()
@require_tenant
def list_simulados():
    """
    Lista simulados disponíveis.
    Produtor: todos do tenant.
    Aluno: apenas ativos do(s) curso(s) em que está matriculado.
    """
    tenant = get_current_tenant()
    claims = get_jwt()
    user_id = get_jwt_identity()

    course_id = request.args.get("course_id")

    query = Simulado.query.filter_by(
        tenant_id=tenant.id,
        is_deleted=False,
    )

    if course_id:
        query = query.filter_by(course_id=course_id)

    if not _is_producer_or_above(claims):
        # Aluno: apenas simulados ativos
        query = query.filter_by(is_active=True)

    simulados = query.order_by(Simulado.created_at.desc()).all()

    result = []
    for sim in simulados:
        total_q = SimuladoQuestion.query.filter_by(
            simulado_id=sim.id, is_deleted=False
        ).count()

        # Status da tentativa do aluno neste simulado
        last_attempt = None
        if not _is_producer_or_above(claims):
            last_attempt = (
                SimuladoAttempt.query.filter_by(
                    simulado_id=sim.id,
                    user_id=user_id,
                    is_deleted=False,
                )
                .order_by(SimuladoAttempt.created_at.desc())
                .first()
            )

        result.append(
            {
                **_serialize_simulado(sim, total_questions=total_q),
                "my_attempt": (
                    _serialize_attempt_summary(last_attempt) if last_attempt else None
                ),
            }
        )

    return jsonify({"simulados": result}), 200


@simulados_bp.route("/<string:simulado_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_simulado(simulado_id: str):
    """Detalhes do simulado. Aluno não vê gabarito antes de iniciar."""
    tenant = get_current_tenant()
    claims = get_jwt()
    user_id = get_jwt_identity()

    simulado = _get_simulado_or_404(simulado_id, tenant.id)
    if not simulado:
        return jsonify({"error": "not_found"}), 404

    is_producer = _is_producer_or_above(claims)

    sim_questions = (
        SimuladoQuestion.query.filter_by(
            simulado_id=simulado.id,
            is_deleted=False,
        )
        .order_by(SimuladoQuestion.order)
        .all()
    )

    questions_data = []
    for sq in sim_questions:
        q = sq.question
        if not q or q.is_deleted:
            continue
        q_data = {
            "id": q.id,
            "statement": q.statement,
            "context": q.context,
            "discipline": q.discipline,
            "difficulty": q.difficulty.value if q.difficulty else None,
            "alternatives": [
                {"key": a.key, "text": a.text}
                for a in sorted(q.alternatives, key=lambda x: x.key)
            ],
        }
        # Produtor vê gabarito; aluno não
        if is_producer:
            q_data["correct_alternative_key"] = q.correct_alternative_key
        questions_data.append(q_data)

    return (
        jsonify(
            {
                "simulado": {
                    **_serialize_simulado(
                        simulado, total_questions=len(questions_data)
                    ),
                    "questions": questions_data,
                }
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# TENTATIVAS (aluno)
# ══════════════════════════════════════════════════════════════════════════════


@simulados_bp.route("/<string:simulado_id>/start", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("20 per hour")
def start_attempt(simulado_id: str):
    """
    Aluno inicia tentativa.
    Para simulados personalizados, seleciona questões pelo histórico do aluno
    e armazena os IDs em attempt.subject_performance["_question_ids"].
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    simulado = _get_simulado_or_404(simulado_id, tenant.id)
    if not simulado or not simulado.is_active:
        return jsonify({"error": "not_found"}), 404

    # Retoma tentativa em andamento
    in_progress = SimuladoAttempt.query.filter_by(
        simulado_id=simulado.id,
        user_id=user_id,
        status="in_progress",
        is_deleted=False,
    ).first()

    if in_progress:
        if _is_attempt_expired(in_progress, simulado):
            _finalize_attempt(in_progress, simulado, timed_out=True)
            db.session.commit()
        else:
            return (
                jsonify(
                    {
                        "message": "Tentativa em andamento retomada.",
                        "attempt": _serialize_attempt_detail(in_progress, simulado),
                        "time_remaining_seconds": _get_time_remaining(
                            in_progress, simulado
                        ),
                    }
                ),
                200,
            )

    settings = simulado.settings or {}
    question_filter = settings.get("question_filter", "all")
    now = datetime.now(timezone.utc)

    # ── Simulado PERSONALIZADO ────────────────────────────────────────────────
    if question_filter != "all":
        total = settings.get("total_questions", 20)
        difficulty = settings.get("difficulty")
        disciplines_config = settings.get("disciplines")

        # Histórico do aluno
        correct_ids = set(
            row[0]
            for row in db.session.query(QuestionAttempt.question_id)
            .filter_by(
                user_id=user_id, tenant_id=tenant.id, is_correct=True, is_deleted=False
            )
            .distinct()
            .all()
        )
        wrong_and_never_correct_ids = (
            set(
                row[0]
                for row in db.session.query(QuestionAttempt.question_id)
                .filter_by(
                    user_id=user_id,
                    tenant_id=tenant.id,
                    is_correct=False,
                    is_deleted=False,
                )
                .distinct()
                .all()
            )
            - correct_ids
        )
        answered_ids = correct_ids | wrong_and_never_correct_ids

        def _select_with_filter(count: int, discipline=None, topic=None) -> list:
            """Busca questões e filtra por histórico, com fallback aleatório."""
            import random as _random

            candidates = _auto_select_questions(
                tenant.id,
                {
                    "count": count * 4,
                    "discipline": discipline,
                    "topic": topic,
                    "difficulty": difficulty,
                },
            )

            if question_filter == "not_answered":
                preferred = [q for q in candidates if q not in answered_ids]
                fallback = [q for q in candidates if q in answered_ids]
            elif question_filter == "previously_correct":
                preferred = [q for q in candidates if q in correct_ids]
                fallback = [q for q in candidates if q not in correct_ids]
            elif question_filter == "previously_wrong":
                preferred = [q for q in candidates if q in wrong_and_never_correct_ids]
                fallback = [
                    q for q in candidates if q not in wrong_and_never_correct_ids
                ]
            else:
                preferred = candidates
                fallback = []

            _random.shuffle(preferred)
            _random.shuffle(fallback)
            combined = preferred + fallback
            return combined[:count]

        question_ids: list = []

        if disciplines_config:
            for block in disciplines_config:
                disc = block.get("discipline") or None
                topic = block.get("topic") or None
                cnt = min(int(block.get("count", 10)), 50)
                ids = _select_with_filter(cnt, disc, topic)
                new = [qid for qid in ids if qid not in question_ids]
                question_ids.extend(new)
        else:
            question_ids = _select_with_filter(total)

        if not question_ids:
            return (
                jsonify(
                    {
                        "error": "no_questions",
                        "message": "Não há questões disponíveis para o seu perfil.",
                    }
                ),
                400,
            )

        attempt = SimuladoAttempt(
            tenant_id=tenant.id,
            simulado_id=simulado.id,
            user_id=user_id,
            started_at=now.isoformat(),
            status="in_progress",
            total_questions=len(question_ids),
            # Armazena IDs personalizados — lidos por _serialize e _finalize
            subject_performance={"_question_ids": question_ids},
        )
        db.session.add(attempt)
        db.session.commit()

        return (
            jsonify(
                {
                    "message": "Simulado iniciado! O tempo está correndo.",
                    "attempt": _serialize_attempt_detail(attempt, simulado),
                    "time_remaining_seconds": simulado.time_limit_minutes * 60,
                    "question_filter": question_filter,
                }
            ),
            201,
        )

    # ── Simulado FIXO: comportamento original ─────────────────────────────────
    attempt = SimuladoAttempt(
        tenant_id=tenant.id,
        simulado_id=simulado.id,
        user_id=user_id,
        started_at=now.isoformat(),
        status="in_progress",
        total_questions=SimuladoQuestion.query.filter_by(
            simulado_id=simulado.id,
            is_deleted=False,
        ).count(),
    )
    db.session.add(attempt)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Simulado iniciado! O tempo está correndo.",
                "attempt": _serialize_attempt_detail(attempt, simulado),
                "time_remaining_seconds": simulado.time_limit_minutes * 60,
            }
        ),
        201,
    )


@simulados_bp.route("/attempts/<string:attempt_id>/answer", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("500 per hour")
def answer_question(attempt_id: str):
    """
    Aluno responde (ou atualiza resposta) de uma questão durante o simulado.
    Salva parcialmente — permite retomar se cair a conexão.

    SEGURANÇA:
    - Valida que tentativa pertence ao usuário
    - Valida que o timer não expirou
    - Não revela se acertou (feedback apenas no final)
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    attempt = SimuladoAttempt.query.filter_by(
        id=attempt_id,
        user_id=user_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    if not attempt:
        return jsonify({"error": "not_found"}), 404

    if attempt.status != "in_progress":
        return (
            jsonify(
                {
                    "error": "attempt_not_active",
                    "message": "Esta tentativa já foi finalizada.",
                }
            ),
            400,
        )

    simulado = _get_simulado_or_404(attempt.simulado_id, tenant.id)

    # SEGURANÇA: Valida timer server-side
    if _is_attempt_expired(attempt, simulado):
        _finalize_attempt(attempt, simulado, timed_out=True)
        db.session.commit()
        return (
            jsonify(
                {
                    "error": "time_expired",
                    "message": "O tempo do simulado expirou. Sua tentativa foi finalizada automaticamente.",
                }
            ),
            400,
        )

    schema = AnswerQuestionSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    # Normaliza para maiúsculo — banco global usa A-E, questões antigas usam a-e
    chosen_key = data.get("chosen_alternative_key")
    if chosen_key:
        data["chosen_alternative_key"] = chosen_key.upper()

    # Valida que a questão pertence ao simulado
    sim_question = SimuladoQuestion.query.filter_by(
        simulado_id=simulado.id,
        question_id=data["question_id"],
        is_deleted=False,
    ).first()
    if not sim_question:
        return jsonify({"error": "question_not_in_simulado"}), 400

    # Atualiza ou cria resposta
    answer = SimuladoAnswer.query.filter_by(
        attempt_id=attempt.id,
        question_id=data["question_id"],
        is_deleted=False,
    ).first()

    if answer:
        answer.chosen_alternative_key = data.get("chosen_alternative_key")
        answer.response_time_seconds = data.get("response_time_seconds")
    else:
        answer = SimuladoAnswer(
            tenant_id=tenant.id,
            attempt_id=attempt.id,
            question_id=data["question_id"],
            chosen_alternative_key=data.get("chosen_alternative_key"),
            response_time_seconds=data.get("response_time_seconds"),
        )
        db.session.add(answer)

    db.session.commit()

    answered_count = (
        SimuladoAnswer.query.filter_by(
            attempt_id=attempt.id,
            is_deleted=False,
        )
        .filter(SimuladoAnswer.chosen_alternative_key.isnot(None))
        .count()
    )

    return (
        jsonify(
            {
                "message": "Resposta salva.",
                "answered": answered_count,
                "total": attempt.total_questions,
                "time_remaining_seconds": _get_time_remaining(attempt, simulado),
            }
        ),
        200,
    )


@simulados_bp.route("/attempts/<string:attempt_id>/finish", methods=["POST"])
@jwt_required()
@require_tenant
def finish_attempt(attempt_id: str):
    """
    Aluno finaliza o simulado.

    O sistema:
    1. Valida timer server-side
    2. Corrige todas as respostas
    3. Calcula score geral e por disciplina
    4. Registra QuestionAttempt para cada resposta (alimenta analytics)
    5. Retorna feedback completo com gabarito e justificativas
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    attempt = SimuladoAttempt.query.filter_by(
        id=attempt_id,
        user_id=user_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()

    if not attempt:
        return jsonify({"error": "not_found"}), 404

    if attempt.status != "in_progress":
        return (
            jsonify(
                {
                    "error": "already_finished",
                    "message": "Esta tentativa já foi finalizada.",
                    "attempt_id": attempt.id,
                }
            ),
            400,
        )

    simulado = _get_simulado_or_404(attempt.simulado_id, tenant.id)

    # Timer: valida se ainda estava dentro do prazo
    timed_out = _is_attempt_expired(attempt, simulado)

    result = _finalize_attempt(attempt, simulado, timed_out=timed_out)
    db.session.commit()

    return (
        jsonify(
            {
                "message": (
                    "Simulado finalizado!"
                    if not timed_out
                    else "Tempo esgotado — simulado finalizado automaticamente."
                ),
                "timed_out": timed_out,
                "result": result,
            }
        ),
        200,
    )


@simulados_bp.route("/attempts/<string:attempt_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_attempt_result(attempt_id: str):
    """
    Retorna resultado detalhado de uma tentativa finalizada.
    Inclui gabarito completo e justificativas questão por questão.
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()
    claims = get_jwt()

    attempt = SimuladoAttempt.query.filter_by(
        id=attempt_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not attempt:
        return jsonify({"error": "not_found"}), 404

    # SEGURANÇA: Aluno só vê sua própria tentativa
    if not _is_producer_or_above(claims) and attempt.user_id != user_id:
        return jsonify({"error": "forbidden"}), 403

    if attempt.status == "in_progress":
        return (
            jsonify(
                {
                    "error": "not_finished",
                    "message": "O simulado ainda está em andamento.",
                }
            ),
            400,
        )

    simulado = _get_simulado_or_404(attempt.simulado_id, tenant.id)
    answers = SimuladoAnswer.query.filter_by(
        attempt_id=attempt.id,
        is_deleted=False,
    ).all()

    # Monta gabarito detalhado
    answers_map = {a.question_id: a for a in answers}
    sim_questions = (
        SimuladoQuestion.query.filter_by(
            simulado_id=simulado.id,
            is_deleted=False,
        )
        .order_by(SimuladoQuestion.order)
        .all()
    )

    detailed_answers = []
    for sq in sim_questions:
        q = sq.question
        if not q:
            continue

        answer = answers_map.get(q.id)
        chosen_key = answer.chosen_alternative_key if answer else None
        is_correct = (
            chosen_key.upper() == q.correct_alternative_key.upper()
            if chosen_key
            else False
        )

        # Justificativa do distrator (erro cometido)
        distractor_just = None
        if not is_correct and chosen_key:
            from sqlalchemy import or_

            chosen_alt = Alternative.query.filter(
                Alternative.question_id == q.id,
                Alternative.key == chosen_key,
                or_(
                    Alternative.tenant_id == tenant.id,
                    Alternative.tenant_id.is_(None),
                ),
            ).first()
            if chosen_alt:
                distractor_just = chosen_alt.distractor_justification

        detailed_answers.append(
            {
                "question_id": q.id,
                "statement": q.statement,
                "discipline": q.discipline,
                "difficulty": q.difficulty.value if q.difficulty else None,
                "chosen_key": chosen_key,
                "correct_key": q.correct_alternative_key,
                "is_correct": is_correct,
                "skipped": chosen_key is None,
                "response_time_seconds": (
                    answer.response_time_seconds if answer else None
                ),
                "alternatives": [
                    {"key": a.key, "text": a.text}
                    for a in sorted(q.alternatives, key=lambda x: x.key)
                ],
                # Feedback pedagógico
                "correct_justification": q.correct_justification,
                "distractor_justification": distractor_just,
            }
        )

    # Percentual por disciplina
    by_discipline = {}
    for item in detailed_answers:
        disc = item["discipline"] or "Sem disciplina"
        if disc not in by_discipline:
            by_discipline[disc] = {"total": 0, "correct": 0, "skipped": 0}
        by_discipline[disc]["total"] += 1
        if item["is_correct"]:
            by_discipline[disc]["correct"] += 1
        if item["skipped"]:
            by_discipline[disc]["skipped"] += 1

    discipline_results = []
    for disc, stats in by_discipline.items():
        total = stats["total"]
        correct = stats["correct"]
        discipline_results.append(
            {
                "discipline": disc,
                "total": total,
                "correct": correct,
                "skipped": stats["skipped"],
                "accuracy_rate": round((correct / total) * 100, 1) if total else 0,
            }
        )

    passing_score = simulado.settings.get("passing_score", 0.6)
    passed = (attempt.score or 0) >= passing_score

    return (
        jsonify(
            {
                "attempt": {
                    "id": attempt.id,
                    "status": attempt.status,
                    "started_at": attempt.started_at,
                    "finished_at": attempt.finished_at,
                    "total_time_seconds": attempt.total_time_seconds,
                },
                "score": {
                    "total_questions": attempt.total_questions,
                    "correct_answers": attempt.correct_answers,
                    "wrong_answers": attempt.total_questions
                    - attempt.correct_answers
                    - sum(1 for a in detailed_answers if a["skipped"]),
                    "skipped": sum(1 for a in detailed_answers if a["skipped"]),
                    "score_percent": round((attempt.score or 0) * 100, 1),
                    "passing_score_percent": round(passing_score * 100, 1),
                    "passed": passed,
                    "time_limit_minutes": simulado.time_limit_minutes,
                },
                "by_discipline": sorted(
                    discipline_results,
                    key=lambda x: x["accuracy_rate"],
                ),
                "answers": detailed_answers,
            }
        ),
        200,
    )


@simulados_bp.route("/my-attempts", methods=["GET"])
@jwt_required()
@require_tenant
def my_attempts():
    """Histórico de tentativas do aluno em todos os simulados."""
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    attempts = (
        SimuladoAttempt.query.filter_by(
            user_id=user_id,
            tenant_id=tenant.id,
            is_deleted=False,
        )
        .order_by(SimuladoAttempt.created_at.desc())
        .all()
    )

    return (
        jsonify(
            {
                "attempts": [_serialize_attempt_summary(a) for a in attempts],
                "total": len(attempts),
                "completed": sum(1 for a in attempts if a.status == "completed"),
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS INTERNOS
# ══════════════════════════════════════════════════════════════════════════════


def _is_attempt_expired(attempt: SimuladoAttempt, simulado: Simulado) -> bool:
    """
    Verifica server-side se o tempo do simulado expirou.
    SEGURANÇA: Nunca confiar no timer do cliente.
    """
    if not attempt.started_at:
        return False
    try:
        started = datetime.fromisoformat(attempt.started_at)
        limit = timedelta(minutes=simulado.time_limit_minutes)
        # Adiciona 30s de tolerância para latência de rede
        return datetime.now(timezone.utc) > started + limit + timedelta(seconds=30)
    except (ValueError, TypeError):
        return False


def _get_time_remaining(attempt: SimuladoAttempt, simulado: Simulado) -> int:
    """Retorna segundos restantes do simulado (mínimo 0)."""
    if not attempt.started_at:
        return simulado.time_limit_minutes * 60
    try:
        started = datetime.fromisoformat(attempt.started_at)
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        remaining = (simulado.time_limit_minutes * 60) - elapsed
        return max(0, int(remaining))
    except (ValueError, TypeError):
        return 0


def _finalize_attempt(
    attempt: "SimuladoAttempt", simulado: "Simulado", timed_out: bool = False
) -> dict:
    """
    Finaliza a tentativa. Suporta simulados fixos e personalizados.
    """
    from sqlalchemy import or_

    now = datetime.now(timezone.utc)

    answers = SimuladoAnswer.query.filter_by(
        attempt_id=attempt.id,
        is_deleted=False,
    ).all()
    answers_map = {a.question_id: a for a in answers}

    # Determina lista de questões (fixas ou personalizadas)
    perf = attempt.subject_performance or {}
    personalized_ids = perf.get("_question_ids")

    if personalized_ids:
        questions = []
        for qid in personalized_ids:
            q = Question.query.filter(
                Question.id == qid,
                Question.is_active == True,
                or_(
                    Question.tenant_id == attempt.tenant_id,
                    Question.tenant_id.is_(None),
                ),
            ).first()
            if q:
                questions.append(q)
    else:
        sim_questions = SimuladoQuestion.query.filter_by(
            simulado_id=simulado.id,
            is_deleted=False,
        ).all()
        questions = [sq.question for sq in sim_questions if sq.question]

    correct_count = 0
    by_discipline: dict = {}

    for q in questions:
        answer = answers_map.get(q.id)
        chosen_key = answer.chosen_alternative_key if answer else None
        is_correct = (
            chosen_key.upper() == q.correct_alternative_key.upper()
            if chosen_key
            else False
        )

        if is_correct:
            correct_count += 1

        if answer:
            answer.is_correct = is_correct

        existing_qa = QuestionAttempt.query.filter_by(
            user_id=attempt.user_id,
            question_id=q.id,
            simulado_attempt_id=attempt.id,
            is_deleted=False,
        ).first()

        if not existing_qa and chosen_key:
            db.session.add(
                QuestionAttempt(
                    tenant_id=attempt.tenant_id,
                    user_id=attempt.user_id,
                    question_id=q.id,
                    chosen_alternative_key=chosen_key,
                    is_correct=is_correct,
                    response_time_seconds=(
                        answer.response_time_seconds if answer else None
                    ),
                    context="simulado",
                    simulado_attempt_id=attempt.id,
                )
            )
            q.total_attempts = (q.total_attempts or 0) + 1
            if is_correct:
                q.correct_attempts = (q.correct_attempts or 0) + 1

        disc = q.discipline or "Sem disciplina"
        if disc not in by_discipline:
            by_discipline[disc] = {"correct": 0, "total": 0}
        by_discipline[disc]["total"] += 1
        if is_correct:
            by_discipline[disc]["correct"] += 1

    total_questions = len(questions)
    score = correct_count / total_questions if total_questions else 0

    try:
        started = datetime.fromisoformat(attempt.started_at)
        total_seconds = int((now - started).total_seconds())
        total_seconds = min(total_seconds, simulado.time_limit_minutes * 60)
    except (ValueError, TypeError):
        total_seconds = None

    subject_perf = {
        disc: {
            "correct": stats["correct"],
            "total": stats["total"],
            "score": (
                round(stats["correct"] / stats["total"], 3) if stats["total"] else 0
            ),
        }
        for disc, stats in by_discipline.items()
    }
    # Preserva _question_ids se era personalizado
    if personalized_ids:
        subject_perf["_question_ids"] = personalized_ids

    attempt.finished_at = now.isoformat()
    attempt.status = "timed_out" if timed_out else "completed"
    attempt.score = round(score, 4)
    attempt.correct_answers = correct_count
    attempt.total_time_seconds = total_seconds
    attempt.subject_performance = subject_perf

    passing_score = simulado.settings.get("passing_score", 0.6)

    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "score_percent": round(score * 100, 1),
        "correct_answers": correct_count,
        "total_questions": total_questions,
        "passed": score >= passing_score,
        "passing_score_percent": round(passing_score * 100, 1),
        "total_time_seconds": total_seconds,
        "by_discipline": [
            {
                "discipline": disc,
                "correct": stats["correct"],
                "total": stats["total"],
                "accuracy_rate": (
                    round(stats["correct"] / stats["total"] * 100, 1)
                    if stats["total"]
                    else 0
                ),
            }
            for disc, stats in by_discipline.items()
        ],
    }


def _auto_select_questions(tenant_id: str, filters: dict) -> list:
    from app.middleware.tenant import get_current_tenant
    from app.models.question import QuestionSourceType, ReviewStatus
    from sqlalchemy import and_, or_
    import random

    count = min(int(filters.get("count", 20)), 100)

    try:
        tenant = get_current_tenant()
        has_bank = tenant.is_feature_enabled("question_bank_concursos")
    except Exception:
        has_bank = False

    own = and_(
        Question.tenant_id == tenant_id,
        Question.is_active == True,
        Question.is_deleted == False,
    )

    if has_bank:
        global_bank = and_(
            Question.tenant_id.is_(None),
            Question.source_type == QuestionSourceType.BANK,
            Question.review_status == "approved",
            Question.is_active == True,
        )
        base_filter = or_(own, global_bank)
    else:
        base_filter = own

    query = Question.query.filter(base_filter)

    if filters.get("topic"):
        query = query.filter(Question.topic.ilike(f"%{filters['topic']}%"))
    if filters.get("difficulty"):
        try:
            query = query.filter(
                Question.difficulty == DifficultyLevel(filters["difficulty"])
            )
        except ValueError:
            pass
    if filters.get("exam_board"):
        query = query.filter(Question.exam_board.ilike(f"%{filters['exam_board']}%"))

    # ── Com disciplina específica: comportamento direto ───────────────────────
    if filters.get("discipline"):
        query = query.filter(Question.discipline.ilike(f"%{filters['discipline']}%"))
        questions = (
            query.order_by(Question.correct_attempts / (Question.total_attempts + 1))
            .limit(count * 2)
            .all()
        )
        random.shuffle(questions)
        return [q.id for q in questions[:count]]

    # ── Sem disciplina: distribui proporcionalmente entre todas ───────────────
    # Busca as disciplinas disponíveis e quantas questões cada uma tem
    from sqlalchemy import func as sqlfunc

    discipline_counts = (
        db.session.query(Question.discipline, sqlfunc.count(Question.id))
        .filter(base_filter, Question.discipline.isnot(None))
        .group_by(Question.discipline)
        .all()
    )

    if not discipline_counts:
        # Fallback: sem disciplinas cadastradas, pega aleatório
        questions = query.limit(count * 2).all()
        random.shuffle(questions)
        return [q.id for q in questions[:count]]

    # Distribui igualmente: count ÷ nº de disciplinas (arredonda para cima)
    num_disciplines = len(discipline_counts)
    per_discipline = max(1, -(-count // num_disciplines))  # ceil division

    result_ids: list = []

    # Embaralha a ordem das disciplinas para evitar viés
    random.shuffle(discipline_counts)

    for discipline, available in discipline_counts:
        if len(result_ids) >= count:
            break

        # Quantas questões ainda faltam no total
        still_needed = count - len(result_ids)
        take = min(per_discipline, still_needed)

        disc_questions = (
            query.filter(Question.discipline == discipline)
            .order_by(Question.correct_attempts / (Question.total_attempts + 1))
            .limit(take * 2)
            .all()
        )
        random.shuffle(disc_questions)
        for q in disc_questions[:take]:
            if q.id not in result_ids:
                result_ids.append(q.id)

    # Se sobrou espaço (alguma disciplina tinha menos questões que o per_discipline),
    # complementa com questões de qualquer disciplina
    if len(result_ids) < count:
        remaining = count - len(result_ids)
        extra = query.filter(Question.id.notin_(result_ids)).limit(remaining * 3).all()
        random.shuffle(extra)
        for q in extra[:remaining]:
            result_ids.append(q.id)

    random.shuffle(result_ids)
    return result_ids[:count]


# ── Serializers ───────────────────────────────────────────────────────────────


def _serialize_simulado(simulado: Simulado, total_questions: int = 0) -> dict:
    return {
        "id": simulado.id,
        "title": simulado.title,
        "description": simulado.description,
        "course_id": simulado.course_id,
        "time_limit_minutes": simulado.time_limit_minutes,
        "total_questions": total_questions,
        "is_active": simulado.is_active,
        "is_ai_generated": simulado.is_ai_generated,
        "settings": simulado.settings,
        "created_at": simulado.created_at.isoformat() if simulado.created_at else None,
    }


def _serialize_attempt_summary(attempt: SimuladoAttempt) -> dict:
    return {
        "id": attempt.id,
        "simulado_id": attempt.simulado_id,
        "status": attempt.status,
        "score_percent": round((attempt.score or 0) * 100, 1),
        "correct_answers": attempt.correct_answers or 0,
        "total_questions": attempt.total_questions or 0,
        "total_time_seconds": attempt.total_time_seconds,
        "started_at": attempt.started_at,
        "finished_at": attempt.finished_at,
    }


def _serialize_attempt_detail(attempt: "SimuladoAttempt", simulado: "Simulado") -> dict:
    """
    Serializa tentativa com questões (sem gabarito).
    Suporta simulados fixos (SimuladoQuestion) e personalizados (_question_ids).
    """
    from sqlalchemy import or_

    perf = attempt.subject_performance or {}
    personalized_ids = perf.get("_question_ids")

    answered_map = {
        a.question_id: a.chosen_alternative_key
        for a in SimuladoAnswer.query.filter_by(
            attempt_id=attempt.id, is_deleted=False
        ).all()
    }

    questions_data = []

    if personalized_ids:
        # Questões personalizadas — lê pelos IDs salvos no attempt
        for qid in personalized_ids:
            q = Question.query.filter(
                Question.id == qid,
                Question.is_active == True,
                or_(
                    Question.tenant_id == attempt.tenant_id,
                    Question.tenant_id.is_(None),
                ),
            ).first()
            if not q:
                continue
            questions_data.append(
                {
                    "id": q.id,
                    "statement": q.statement,
                    "context": q.context,
                    "discipline": q.discipline,
                    "difficulty": q.difficulty.value if q.difficulty else None,
                    "alternatives": [
                        {"key": a.key, "text": a.text}
                        for a in sorted(q.alternatives, key=lambda x: x.key)
                    ],
                    "chosen_key": answered_map.get(q.id),
                }
            )
    else:
        # Questões fixas — lê de SimuladoQuestion
        sim_questions = (
            SimuladoQuestion.query.filter_by(
                simulado_id=simulado.id,
                is_deleted=False,
            )
            .order_by(SimuladoQuestion.order)
            .all()
        )
        for sq in sim_questions:
            q = sq.question
            if not q:
                continue
            questions_data.append(
                {
                    "id": q.id,
                    "statement": q.statement,
                    "context": q.context,
                    "discipline": q.discipline,
                    "difficulty": q.difficulty.value if q.difficulty else None,
                    "alternatives": [
                        {"key": a.key, "text": a.text}
                        for a in sorted(q.alternatives, key=lambda x: x.key)
                    ],
                    "chosen_key": answered_map.get(q.id),
                }
            )

    return {
        "id": attempt.id,
        "status": attempt.status,
        "started_at": attempt.started_at,
        "time_limit_minutes": simulado.time_limit_minutes,
        "total_questions": attempt.total_questions,
        "answered_count": len([v for v in answered_map.values() if v]),
        "questions": questions_data,
    }
