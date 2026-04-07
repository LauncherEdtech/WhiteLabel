# api/app/models/question.py
# Banco de questões compartilhado (global) + questões de aula por tenant.
#
# SEGURANÇA:
#   tenant_id = NULL  → questão do banco global (admin ou produtor aprovado)
#   tenant_id = X     → questão gerada de aula, visível apenas ao tenant X
#
# ACESSO:
#   Use Question.query_for_tenant(tenant) em vez de Question.query direto.
#   Nunca faça filter(tenant_id=...) manual em rotas — centralizado aqui.
# ─────────────────────────────────────────────────────────────────────────────

import enum
import hashlib
import re
import unicodedata
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import BaseModel, TenantMixin


# ── Enums ─────────────────────────────────────────────────────────────────────


class DifficultyLevel(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class QuestionSourceType(str, enum.Enum):
    BANK = "bank"  # Banco global (admin ou produtor aprovado)
    LESSON = "lesson"  # Gerada pelo Gemini a partir de uma aula


class ReviewStatus(str, enum.Enum):
    APPROVED = "approved"  # Visível no banco global
    PENDING = "pending"  # Aguardando revisão do admin
    REJECTED = "rejected"  # Rejeitada pelo admin


class QuestionType(str, enum.Enum):
    INTERPRETACAO = "interpretacao"
    APLICACAO = "aplicacao"
    RACIOCINIO = "raciocinio"
    MEMORIZACAO = "memorizacao"


# ── Helpers de deduplicação ───────────────────────────────────────────────────


def _normalize_statement(text_: str) -> str:
    """Remove acentos, pontuação e normaliza espaços para comparação."""
    t = text_.lower().strip()
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9\s]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def compute_statement_hash(statement: str) -> str:
    """MD5 do enunciado normalizado — usado para detecção rápida de duplicata."""
    return hashlib.md5(_normalize_statement(statement).encode("utf-8")).hexdigest()


# ── Models ────────────────────────────────────────────────────────────────────


class Question(BaseModel, TenantMixin):
    """
    Questão de concurso com metadados pedagógicos completos.

    Dois universos convivem na mesma tabela:
      1. Banco global (tenant_id = NULL, source_type = BANK):
         - Importado pelo admin via bulk-import
         - Submetido por produtor e aprovado pelo admin
         - Visível para todos os tenants com feature question_bank_concursos
      2. Questões de aula (tenant_id = X, source_type = LESSON):
         - Geradas pelo Gemini a partir de vídeos
         - Visíveis apenas ao tenant dono
    """

    __tablename__ = "questions"

    # ── Sobrescreve TenantMixin para permitir NULL (banco global) ────────────
    tenant_id = Column(
        UUID(as_uuid=False),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,  # NULL = questão do banco global
        index=True,
    )

    # ── Identificação e origem ────────────────────────────────────────────────
    external_id = Column(
        String(64),
        unique=True,
        nullable=True,
        index=True,
        comment="ID externo para idempotência no bulk-import (hash do XLSX)",
    )

    source_type = Column(
        Enum(
            QuestionSourceType,
            name="question_source_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=QuestionSourceType.BANK,
        index=True,
    )

    # Preenchido apenas quando source_type = LESSON
    lesson_id = Column(
        UUID(as_uuid=False),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # ── Rastreamento de submissão pelo produtor ───────────────────────────────
    # Quem enviou para revisão (produtor). NULL = importado pelo admin.
    submitted_by_tenant_id = Column(
        UUID(as_uuid=False),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    submitted_by_user_id = Column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Fluxo de revisão ──────────────────────────────────────────────────────
    review_status = Column(
        Enum(
            ReviewStatus,
            name="review_status_enum",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=ReviewStatus.APPROVED,  # admin bulk-import já entra aprovado
        index=True,
    )
    rejection_reason = Column(Text, nullable=True)
    reviewed_by_user_id = Column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at = Column(DateTime, nullable=True)

    # ── Vínculo com conteúdo do produtor ──────────────────────────────────────
    subject_id = Column(UUID(as_uuid=False), ForeignKey("subjects.id"), nullable=True)
    source_document_id = Column(Text, nullable=True)

    # ── Enunciado ─────────────────────────────────────────────────────────────
    statement = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)

    # Hash do enunciado normalizado — detecção rápida de duplicata
    # Populado automaticamente via SQLAlchemy event (veja abaixo)
    statement_hash = Column(String(32), nullable=True, index=True)

    # ── Metadados Pedagógicos ─────────────────────────────────────────────────
    discipline = Column(String(255), nullable=True, index=True)
    topic = Column(String(255), nullable=True, index=True)
    subtopic = Column(String(255), nullable=True)
    microtopic = Column(String(255), nullable=True)

    difficulty = Column(
        Enum(DifficultyLevel, name="difficulty_enum"),
        default=DifficultyLevel.MEDIUM,
        nullable=False,
        index=True,
    )

    question_type = Column(
        Enum(
            QuestionType,
            name="question_type_enum",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=True,
        index=True,
    )

    tip = Column(Text, nullable=True, comment="Dica/macete gerado pelo Gemini")

    # Banca e concurso de origem
    exam_board = Column(String(100), nullable=True, index=True)
    exam_year = Column(Integer, nullable=True)
    exam_name = Column(String(255), nullable=True)
    competency = Column(String(255), nullable=True)

    # ── Gabarito e Justificativas ─────────────────────────────────────────────
    correct_alternative_key = Column(String(1), nullable=False)
    correct_justification = Column(Text, nullable=True)

    # ── Status ────────────────────────────────────────────────────────────────
    is_active = Column(Boolean, default=True, nullable=False)
    is_reviewed = Column(Boolean, default=False, nullable=False)

    # ── Estatísticas agregadas (atualizadas via Celery) ───────────────────────
    total_attempts = Column(Integer, default=0, nullable=False)
    correct_attempts = Column(Integer, default=0, nullable=False)
    avg_response_time_seconds = Column(Float, default=0.0, nullable=False)

    # ── Relacionamentos ───────────────────────────────────────────────────────
    subject = relationship("Subject", back_populates="questions")
    lesson = relationship(
        "Lesson", back_populates="questions", foreign_keys=[lesson_id]
    )

    submitted_by_tenant = relationship(
        "Tenant", foreign_keys=[submitted_by_tenant_id], lazy="select"
    )

    alternatives = relationship(
        "Alternative",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="Alternative.key",
    )
    attempts = relationship(
        "QuestionAttempt",
        back_populates="question",
        lazy="dynamic",
    )
    tags = relationship(
        "QuestionTag",
        back_populates="question",
        cascade="all, delete-orphan",
    )

    # ── Query helpers (SEMPRE usar em vez de Question.query direto) ───────────

    @classmethod
    def query_for_tenant(cls, tenant, session=None):
        """
        Retorna query com questões visíveis para um tenant.

        Regras:
          - Questões de aula do próprio tenant: sempre visíveis
          - Banco global (tenant_id IS NULL, review_status = APPROVED):
            apenas se tenant.is_feature_enabled("question_bank_concursos")
          - Questões pendentes/rejeitadas do próprio produtor:
            visíveis apenas para o próprio tenant (via submitted_by_tenant_id)
        """
        from .. import db

        q = (session or db.session).query(cls)

        own_lessons = (cls.tenant_id == tenant.id) & (
            cls.source_type == QuestionSourceType.LESSON
        )

        if tenant.is_feature_enabled("question_bank_concursos"):
            global_approved = (
                cls.tenant_id.is_(None)
                & (cls.source_type == QuestionSourceType.BANK)
                & (cls.review_status == ReviewStatus.APPROVED)
            )
            # Questões que o próprio produtor submeteu (qualquer status)
            own_submitted = cls.submitted_by_tenant_id == tenant.id

            return q.filter(own_lessons | global_approved | own_submitted)

        return q.filter(own_lessons)

    @classmethod
    def find_duplicate(cls, statement: str, exclude_id: str = None):
        """
        Busca questão com hash idêntico no banco global.
        Retorna a Question duplicada ou None.
        """
        from .. import db

        h = compute_statement_hash(statement)
        query = db.session.query(cls).filter(
            cls.statement_hash == h,
            cls.tenant_id.is_(None),
            cls.source_type == QuestionSourceType.BANK,
        )
        if exclude_id:
            query = query.filter(cls.id != exclude_id)
        return query.first()

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def accuracy_rate(self) -> float:
        if self.total_attempts == 0:
            return 0.0
        return round(self.correct_attempts / self.total_attempts, 4)

    @property
    def is_global(self) -> bool:
        return self.tenant_id is None and self.source_type == QuestionSourceType.BANK

    def __repr__(self):
        return f"<Question {self.id[:8]} [{self.source_type}/{self.difficulty}/{self.review_status}]>"


# ── Auto-hash no statement ────────────────────────────────────────────────────


@event.listens_for(Question.statement, "set")
def _set_statement_hash(target, value, oldvalue, initiator):
    """Recalcula statement_hash sempre que o enunciado mudar."""
    if value:
        target.statement_hash = compute_statement_hash(value)


# ── Alternative ───────────────────────────────────────────────────────────────


class Alternative(BaseModel, TenantMixin):
    """
    Alternativa de uma questão (A, B, C, D, E).
    Inclui justificativa do distrator — essencial para aprendizado.
    """

    __tablename__ = "alternatives"

    question_id = Column(
        UUID(as_uuid=False),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    key = Column(String(1), nullable=False)  # "A", "B", "C", "D", "E"
    text = Column(Text, nullable=False)
    distractor_justification = Column(Text, nullable=True)

    question = relationship("Question", back_populates="alternatives")

    __table_args__ = (
        UniqueConstraint("question_id", "key", name="uq_alternative_question_key"),
    )


# ── QuestionAttempt ───────────────────────────────────────────────────────────


class QuestionAttempt(BaseModel, TenantMixin):
    """
    Registro de cada resposta de um aluno.

    SEGURANÇA: tenant_id sempre preenchido — dados de aluno nunca são globais.
    A questão respondida pode ser global (tenant_id NULL na Question),
    mas a tentativa sempre pertence ao tenant.

    UNICIDADE:
    - Contextos não-simulado (practice, schedule, review, lesson):
        UNIQUE(user_id, question_id, context) — index parcial WHERE context != 'simulado'
    - Contexto simulado:
        UNIQUE(user_id, question_id, simulado_attempt_id) — index parcial WHERE context = 'simulado'
        Isso permite a mesma questão em simulados DIFERENTES sem conflito.
    """

    __tablename__ = "question_attempts"

    # Override para garantir NOT NULL (dados de aluno nunca podem ser globais)
    tenant_id = Column(
        UUID(as_uuid=False),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,  # ← Obrigatório — diferente de Question
        index=True,
    )

    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    question_id = Column(
        UUID(as_uuid=False), ForeignKey("questions.id"), nullable=False
    )

    chosen_alternative_key = Column(String(1), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    response_time_seconds = Column(Integer, nullable=True)

    # Contexto da tentativa (analytics segmentado)
    context = Column(
        String(50),
        default="practice",
        nullable=False,
        comment="practice | simulado | schedule | review | lesson",
    )

    simulado_attempt_id = Column(
        UUID(as_uuid=False),
        ForeignKey("simulado_attempts.id"),
        nullable=True,
    )

    user = relationship("User", back_populates="question_attempts")
    question = relationship("Question", back_populates="attempts")

    __table_args__ = (
        # Contextos não-simulado: impede dupla tentativa na mesma questão/contexto
        # Usa partial index — não interfere com simulados
        Index(
            "uq_attempt_non_simulado",
            "user_id",
            "question_id",
            "context",
            unique=True,
            postgresql_where=text("context != 'simulado'"),
        ),
        # Contexto simulado: impede duplicata dentro do MESMO simulado,
        # mas permite a mesma questão em simulados diferentes
        Index(
            "uq_attempt_simulado",
            "user_id",
            "question_id",
            "simulado_attempt_id",
            unique=True,
            postgresql_where=text("context = 'simulado'"),
        ),
    )


# ── QuestionTag ───────────────────────────────────────────────────────────────


class QuestionTag(BaseModel, TenantMixin):
    """Tags para organização e busca de questões."""

    __tablename__ = "question_tags"

    question_id = Column(
        UUID(as_uuid=False),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    tag = Column(String(100), nullable=False, index=True)

    question = relationship("Question", back_populates="tags")

    __table_args__ = (UniqueConstraint("question_id", "tag", name="uq_question_tag"),)
