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
    BANK = "bank"
    LESSON = "lesson"


class ReviewStatus(str, enum.Enum):
    APPROVED = "approved"
    PENDING = "pending"
    REJECTED = "rejected"


class QuestionType(str, enum.Enum):
    INTERPRETACAO = "interpretacao"
    APLICACAO = "aplicacao"
    RACIOCINIO = "raciocinio"
    MEMORIZACAO = "memorizacao"


# ── Helpers de deduplicação ───────────────────────────────────────────────────


def _normalize_statement(text_: str) -> str:
    t = text_.lower().strip()
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9\s]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def compute_statement_hash(statement: str) -> str:
    return hashlib.md5(_normalize_statement(statement).encode("utf-8")).hexdigest()


# ── Models ────────────────────────────────────────────────────────────────────


class Question(BaseModel, TenantMixin):
    __tablename__ = "questions"

    tenant_id = Column(
        UUID(as_uuid=False),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    external_id = Column(String(64), unique=True, nullable=True, index=True)

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

    lesson_id = Column(
        UUID(as_uuid=False),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

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

    review_status = Column(
        Enum(
            ReviewStatus,
            name="review_status_enum",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=ReviewStatus.APPROVED,
        index=True,
    )
    rejection_reason = Column(Text, nullable=True)
    reviewed_by_user_id = Column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at = Column(DateTime, nullable=True)

    subject_id = Column(UUID(as_uuid=False), ForeignKey("subjects.id"), nullable=True)
    source_document_id = Column(Text, nullable=True)

    statement = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    statement_hash = Column(String(32), nullable=True, index=True)

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

    exam_board = Column(String(100), nullable=True, index=True)
    exam_year = Column(Integer, nullable=True)
    exam_name = Column(String(255), nullable=True)
    competency = Column(String(255), nullable=True)

    correct_alternative_key = Column(String(1), nullable=False)
    correct_justification = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    is_reviewed = Column(Boolean, default=False, nullable=False)

    # Marcado True pelo analyze_question_task após Gemini processar.
    # Questões não enriquecidas ficam invisíveis para alunos e produtores.
    gemini_enriched = Column(
        Boolean,
        default=False,
        nullable=False,
        server_default="false",
        comment="True quando o Gemini já preencheu tópico, dica e distratores",
    )

    total_attempts = Column(Integer, default=0, nullable=False)
    correct_attempts = Column(Integer, default=0, nullable=False)
    avg_response_time_seconds = Column(Float, default=0.0, nullable=False)

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

    @classmethod
    def query_for_tenant(cls, tenant, session=None):
        """
        Retorna query com questões visíveis para um tenant.
        Questões de aula: sempre visíveis (não passam pelo Gemini).
        Banco global: apenas gemini_enriched=True.
        Banco próprio: apenas gemini_enriched=True.
        """
        from .. import db

        q = (session or db.session).query(cls)

        # Questões de aula — sempre visíveis independente de gemini_enriched
        own_lessons = (cls.tenant_id == tenant.id) & (
            cls.source_type == QuestionSourceType.LESSON
        )

        if tenant.is_feature_enabled("question_bank_concursos"):
            # Banco global: aprovada E processada pelo Gemini
            global_approved = (
                cls.tenant_id.is_(None)
                & (cls.source_type == QuestionSourceType.BANK)
                & (cls.review_status == ReviewStatus.APPROVED)
                & (cls.gemini_enriched == True)
            )
            # Questões submetidas pelo próprio produtor (qualquer status)
            # visíveis para ele acompanhar — mesmo sem gemini_enriched
            own_submitted = cls.submitted_by_tenant_id == tenant.id

            return q.filter(own_lessons | global_approved | own_submitted)

        # Banco próprio do tenant: só aparece após Gemini processar
        own_bank = (
            (cls.tenant_id == tenant.id)
            & (cls.source_type == QuestionSourceType.BANK)
            & (cls.gemini_enriched == True)
            & (cls.is_active == True)
            & (cls.is_deleted == False)
        )

        return q.filter(own_lessons | own_bank)

    @classmethod
    def find_duplicate(cls, statement: str, exclude_id: str = None):
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


@event.listens_for(Question.statement, "set")
def _set_statement_hash(target, value, oldvalue, initiator):
    if value:
        target.statement_hash = compute_statement_hash(value)


class Alternative(BaseModel, TenantMixin):
    __tablename__ = "alternatives"

    question_id = Column(
        UUID(as_uuid=False),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    key = Column(String(1), nullable=False)
    text = Column(Text, nullable=False)
    distractor_justification = Column(Text, nullable=True)

    question = relationship("Question", back_populates="alternatives")

    __table_args__ = (
        UniqueConstraint("question_id", "key", name="uq_alternative_question_key"),
    )


class QuestionAttempt(BaseModel, TenantMixin):
    __tablename__ = "question_attempts"

    tenant_id = Column(
        UUID(as_uuid=False),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    question_id = Column(
        UUID(as_uuid=False), ForeignKey("questions.id"), nullable=False
    )

    chosen_alternative_key = Column(String(1), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    response_time_seconds = Column(Integer, nullable=True)

    context = Column(
        String(50),
        default="practice",
        nullable=False,
    )

    simulado_attempt_id = Column(
        UUID(as_uuid=False),
        ForeignKey("simulado_attempts.id"),
        nullable=True,
    )

    user = relationship("User", back_populates="question_attempts")
    question = relationship("Question", back_populates="attempts")

    __table_args__ = (
        Index(
            "uq_attempt_non_simulado",
            "user_id",
            "question_id",
            "context",
            unique=True,
            postgresql_where=text("context != 'simulado'"),
        ),
        Index(
            "uq_attempt_simulado",
            "user_id",
            "question_id",
            "simulado_attempt_id",
            unique=True,
            postgresql_where=text("context = 'simulado'"),
        ),
    )


class QuestionTag(BaseModel, TenantMixin):
    __tablename__ = "question_tags"

    question_id = Column(
        UUID(as_uuid=False),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    tag = Column(String(100), nullable=False, index=True)

    question = relationship("Question", back_populates="tags")

    __table_args__ = (UniqueConstraint("question_id", "tag", name="uq_question_tag"),)