# api/app/routes/admin/questions.py
#
# Rotas administrativas para o banco de questões compartilhado.
#
# Responsabilidades:
#   - Bulk-import via JSON processado pelo notebook Gemini
#   - Listagem de questões pendentes por produtor
#   - Aprovação / Rejeição com motivo
#   - Visão geral do banco (stats por disciplina, produtor etc.)
# ─────────────────────────────────────────────────────────────────────────────

from datetime import datetime
from uuid import uuid4

from flask import Blueprint, g, jsonify, request

from ...models.question import (
    Alternative,
    DifficultyLevel,
    Question,
    QuestionSourceType,
    QuestionTag,
    QuestionType,
    ReviewStatus,
    compute_statement_hash,
)
from ...models.tenant import Tenant
from ...extensions import db
from ...decorators import admin_required

admin_questions_bp = Blueprint("admin_questions", __name__)


# ── Mapeamentos de normalização ───────────────────────────────────────────────
# O notebook Gemini pode gerar variações — normalizamos aqui na borda de entrada.

_DIFFICULTY_MAP = {
    "easy": DifficultyLevel.EASY,
    "medium": DifficultyLevel.MEDIUM,
    "hard": DifficultyLevel.HARD,
    "facil": DifficultyLevel.EASY,
    "medio": DifficultyLevel.MEDIUM,
    "dificil": DifficultyLevel.HARD,
}

_QTYPE_MAP = {
    "interpretacao": QuestionType.INTERPRETACAO,
    "interpretação": QuestionType.INTERPRETACAO,
    "aplicacao": QuestionType.APLICACAO,
    "aplicação": QuestionType.APLICACAO,
    "raciocinio": QuestionType.RACIOCINIO,
    "raciocínio": QuestionType.RACIOCINIO,
    "memorizacao": QuestionType.MEMORIZACAO,
    "memorização": QuestionType.MEMORIZACAO,
    "definicao": QuestionType.MEMORIZACAO,  # mapeado para mais próximo
    "definição": QuestionType.MEMORIZACAO,
}


# ── Serializer ────────────────────────────────────────────────────────────────


def _serialize_question_admin(q: Question) -> dict:
    submitted_tenant = None
    if q.submitted_by_tenant_id:
        t = db.session.get(Tenant, q.submitted_by_tenant_id)
        if t:
            submitted_tenant = {"id": t.id, "name": t.name, "slug": t.slug}

    return {
        "id": q.id,
        "external_id": q.external_id,
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
        "review_status": q.review_status.value,
        "rejection_reason": q.rejection_reason,
        "reviewed_at": q.reviewed_at.isoformat() if q.reviewed_at else None,
        "submitted_by_tenant": submitted_tenant,
        "is_active": q.is_active,
        "total_attempts": q.total_attempts,
        "accuracy_rate": q.accuracy_rate,
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


# ── Bulk Import ───────────────────────────────────────────────────────────────


@admin_questions_bp.route("/questions/bulk-import", methods=["POST"])
@admin_required
def bulk_import():
    """
    Importa lista de questões processadas pelo notebook Gemini.

    Comportamento:
      - external_id existente → atualiza campos (exceto alternatives já criadas)
      - Novo → cria com review_status = APPROVED, tenant_id = NULL
      - Duplicata por hash (sem external_id) → skipa e reporta

    Body: array JSON no formato gerado pelo notebook (questoes_para_importacao.json)
    """
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify(error="Esperado um array JSON"), 400

    inserted = updated = skipped = errors = 0
    skip_details = []
    error_details = []

    for item in data:
        ext_id = item.get("external_id")
        try:
            # 1. Tenta por external_id (idempotência)
            q = (
                db.session.query(Question).filter_by(external_id=ext_id).first()
                if ext_id
                else None
            )

            # 2. Se não encontrou por external_id, verifica duplicata por hash
            if q is None:
                duplicate = Question.find_duplicate(item.get("statement", ""))
                if duplicate:
                    skip_details.append(
                        {
                            "external_id": ext_id,
                            "reason": "hash_duplicate",
                            "existing_id": duplicate.id,
                        }
                    )
                    skipped += 1
                    continue

            is_new = q is None

            if is_new:
                q = Question()
                q.id = str(uuid4())
                q.external_id = ext_id
                q.tenant_id = None  # Banco global
                q.source_type = QuestionSourceType.BANK
                q.review_status = ReviewStatus.APPROVED  # Admin import = já aprovado
                q.submitted_by_tenant_id = None
                q.submitted_by_user_id = None

            # Campos atualizáveis
            q.statement = item["statement"]
            q.discipline = item.get("discipline", "").strip().upper()
            q.topic = item.get("topic")
            q.subtopic = item.get("subtopic")
            q.difficulty = _DIFFICULTY_MAP.get(
                item.get("difficulty", "medium"), DifficultyLevel.MEDIUM
            )
            q.question_type = _QTYPE_MAP.get(item.get("question_type", ""))
            q.correct_alternative_key = item.get("correct_answer_key", "").upper()
            q.correct_justification = item.get("explanation")
            q.tip = item.get("tip")
            q.exam_board = item.get("exam_board")
            q.exam_year = item.get("exam_year")
            q.exam_name = item.get("exam_name")
            q.source_document_id = item.get("source")
            q.is_active = True
            # statement_hash setado automaticamente via event listener

            if is_new:
                db.session.add(q)
                db.session.flush()

                # Alternatives (apenas na criação — atualização preserva as existentes)
                for alt in item.get("alternatives", []):
                    db.session.add(
                        Alternative(
                            id=str(uuid4()),
                            tenant_id=None,
                            question_id=q.id,
                            key=alt["key"].upper(),
                            text=alt["text"],
                            distractor_justification=(
                                alt.get("explanation")
                                if not alt.get("is_correct")
                                else None
                            ),
                        )
                    )

                # Tags
                db.session.query(QuestionTag).filter_by(question_id=q.id).delete()
                for tag_str in item.get("tags", []):
                    tag_str = tag_str.strip().lower()
                    if tag_str:
                        db.session.add(
                            QuestionTag(
                                id=str(uuid4()),
                                tenant_id=None,
                                question_id=q.id,
                                tag=tag_str,
                            )
                        )

                inserted += 1
            else:
                updated += 1

            # Commit em lotes para não manter transação aberta
            if (inserted + updated) % 50 == 0:
                db.session.commit()

        except Exception as e:
            db.session.rollback()
            errors += 1
            error_details.append(
                {
                    "external_id": ext_id,
                    "error": str(e),
                }
            )

    db.session.commit()

    return (
        jsonify(
            inserted=inserted,
            updated=updated,
            skipped=skipped,
            errors=errors,
            skip_details=skip_details[:20],  # Limita payload
            error_details=error_details[:20],
        ),
        200,
    )


# ── Listagem de questões (admin) ──────────────────────────────────────────────


@admin_questions_bp.route("/questions", methods=["GET"])
@admin_required
def list_questions():
    """
    Lista todas as questões do banco global com filtros avançados.

    Filtros: discipline, topic, difficulty, question_type,
             review_status, submitted_by_tenant_id, page, per_page
    """
    discipline = request.args.get("discipline")
    topic = request.args.get("topic")
    difficulty = request.args.get("difficulty")
    q_type = request.args.get("question_type")
    review_status = request.args.get("review_status")
    tenant_filter = request.args.get("submitted_by_tenant_id")
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 30)), 100)

    query = db.session.query(Question).filter(
        Question.source_type == QuestionSourceType.BANK,
        Question.tenant_id.is_(None),
    )

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
    if tenant_filter:
        query = query.filter(Question.submitted_by_tenant_id == tenant_filter)

    paginated = query.order_by(Question.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify(
        questions=[_serialize_question_admin(q) for q in paginated.items],
        total=paginated.total,
        page=page,
        pages=paginated.pages,
    )


@admin_questions_bp.route("/questions/pending", methods=["GET"])
@admin_required
def list_pending():
    """
    Lista questões pendentes de revisão, agrupadas por produtor.
    Filtro opcional por tenant_id para ver apenas de um produtor específico.
    """
    tenant_filter = request.args.get("tenant_id")
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 30)), 100)

    query = db.session.query(Question).filter(
        Question.review_status == ReviewStatus.PENDING,
        Question.source_type == QuestionSourceType.BANK,
        Question.tenant_id.is_(None),
    )

    if tenant_filter:
        query = query.filter(Question.submitted_by_tenant_id == tenant_filter)

    paginated = query.order_by(Question.created_at.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    # Resumo por produtor
    from sqlalchemy import func

    summary = (
        db.session.query(
            Question.submitted_by_tenant_id,
            func.count(Question.id).label("count"),
        )
        .filter(
            Question.review_status == ReviewStatus.PENDING,
            Question.source_type == QuestionSourceType.BANK,
            Question.tenant_id.is_(None),
            Question.submitted_by_tenant_id.isnot(None),
        )
        .group_by(Question.submitted_by_tenant_id)
        .all()
    )

    summary_with_names = []
    for tenant_id, count in summary:
        t = db.session.get(Tenant, tenant_id)
        summary_with_names.append(
            {
                "tenant_id": tenant_id,
                "tenant_name": t.name if t else "Desconhecido",
                "tenant_slug": t.slug if t else None,
                "count": count,
            }
        )

    return jsonify(
        questions=[_serialize_question_admin(q) for q in paginated.items],
        total=paginated.total,
        page=page,
        pages=paginated.pages,
        by_tenant=summary_with_names,
    )


# ── Ações de revisão ──────────────────────────────────────────────────────────


@admin_questions_bp.route("/questions/<question_id>/approve", methods=["POST"])
@admin_required
def approve_question(question_id):
    """
    Aprova uma questão pendente → entra no banco global visível a todos.
    Idempotente: aprovar uma já aprovada não causa erro.
    """
    q = db.session.get(Question, question_id)
    if not q:
        return jsonify(error="Questão não encontrada"), 404
    if q.source_type != QuestionSourceType.BANK or q.tenant_id is not None:
        return jsonify(error="Apenas questões do banco global podem ser revisadas"), 400

    q.review_status = ReviewStatus.APPROVED
    q.rejection_reason = None
    q.reviewed_by_user_id = g.current_user.id
    q.reviewed_at = datetime.utcnow()
    q.is_reviewed = True

    db.session.commit()

    return jsonify(
        message="Questão aprovada com sucesso.",
        question=_serialize_question_admin(q),
    )


@admin_questions_bp.route("/questions/<question_id>/reject", methods=["POST"])
@admin_required
def reject_question(question_id):
    """
    Rejeita uma questão com motivo obrigatório.
    A questão continua no banco (com status = rejected) para o produtor consultar.
    """
    q = db.session.get(Question, question_id)
    if not q:
        return jsonify(error="Questão não encontrada"), 404
    if q.source_type != QuestionSourceType.BANK or q.tenant_id is not None:
        return jsonify(error="Apenas questões do banco global podem ser revisadas"), 400

    data = request.get_json() or {}
    reason = (data.get("reason") or "").strip()
    if not reason:
        return jsonify(error="Motivo da rejeição é obrigatório"), 400

    q.review_status = ReviewStatus.REJECTED
    q.rejection_reason = reason
    q.reviewed_by_user_id = g.current_user.id
    q.reviewed_at = datetime.utcnow()
    q.is_reviewed = True

    db.session.commit()

    return jsonify(
        message="Questão rejeitada.",
        question=_serialize_question_admin(q),
    )


@admin_questions_bp.route("/questions/<question_id>", methods=["DELETE"])
@admin_required
def delete_question(question_id):
    """Remove permanentemente uma questão do banco (soft-delete via is_active)."""
    q = db.session.get(Question, question_id)
    if not q:
        return jsonify(error="Questão não encontrada"), 404

    q.is_active = False
    db.session.commit()
    return jsonify(message="Questão desativada.")


# ── Stats do banco ────────────────────────────────────────────────────────────


@admin_questions_bp.route("/questions/stats", methods=["GET"])
@admin_required
def bank_stats():
    """Visão geral do banco de questões para o painel admin."""
    from sqlalchemy import func

    base = db.session.query(Question).filter(
        Question.source_type == QuestionSourceType.BANK,
        Question.tenant_id.is_(None),
    )

    by_status = {
        r[0].value: r[1]
        for r in base.with_entities(Question.review_status, func.count(Question.id))
        .group_by(Question.review_status)
        .all()
    }

    by_discipline = {
        r[0]: r[1]
        for r in base.filter(Question.review_status == ReviewStatus.APPROVED)
        .with_entities(Question.discipline, func.count(Question.id))
        .group_by(Question.discipline)
        .order_by(func.count(Question.id).desc())
        .all()
    }

    by_difficulty = {
        r[0].value: r[1]
        for r in base.filter(Question.review_status == ReviewStatus.APPROVED)
        .with_entities(Question.difficulty, func.count(Question.id))
        .group_by(Question.difficulty)
        .all()
    }

    # Top produtores por volume de submissões
    top_submitters = (
        base.filter(Question.submitted_by_tenant_id.isnot(None))
        .with_entities(
            Question.submitted_by_tenant_id, func.count(Question.id).label("total")
        )
        .group_by(Question.submitted_by_tenant_id)
        .order_by(func.count(Question.id).desc())
        .limit(10)
        .all()
    )
    top_submitters_named = []
    for tenant_id, total in top_submitters:
        t = db.session.get(Tenant, tenant_id)
        top_submitters_named.append(
            {
                "tenant_id": tenant_id,
                "tenant_name": t.name if t else "Desconhecido",
                "total": total,
            }
        )

    return jsonify(
        total_questions=base.count(),
        by_status=by_status,
        by_discipline=by_discipline,
        by_difficulty=by_difficulty,
        top_submitters=top_submitters_named,
    )
