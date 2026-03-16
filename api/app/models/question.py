# api/app/models/question.py
# Banco de questões com metadados ricos para filtros e IA adaptativa.
# SEGURANÇA: Questões pertencem ao tenant — nunca visíveis entre produtores.

from sqlalchemy import (
    Column, String, Text, Boolean, Integer,
    ForeignKey, JSON, Float, Enum
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from .base import BaseModel, TenantMixin


class DifficultyLevel(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Question(BaseModel, TenantMixin):
    """
    Questão de concurso com metadados pedagógicos completos.

    Metadados extraídos pelo Gemini via pipeline assíncrono:
    - Disciplina, tema, subtema, microtema
    - Nível de dificuldade
    - Banca, ano, competência avaliada
    - Justificativas (correta + cada distrator)
    """
    __tablename__ = "questions"

    # ── Vínculo com conteúdo do produtor ──────────────────────────────────────
    subject_id = Column(UUID(as_uuid=False), ForeignKey("subjects.id"), nullable=True)
    # Fonte original da questão (prova, edital, manual)
    source_document_id = Column(String(255), nullable=True)

    # ── Enunciado ─────────────────────────────────────────────────────────────
    statement = Column(Text, nullable=False)   # Texto principal da questão
    # Contexto adicional (tabelas, textos base para interpretação)
    context = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)

    # ── Metadados Pedagógicos ─────────────────────────────────────────────────
    discipline = Column(String(255), nullable=True, index=True)   # Área principal
    topic = Column(String(255), nullable=True, index=True)        # Tema
    subtopic = Column(String(255), nullable=True)                  # Subtema
    microtopic = Column(String(255), nullable=True)                # Microtema

    difficulty = Column(
        Enum(DifficultyLevel, name="difficulty_enum"),
        default=DifficultyLevel.MEDIUM,
        nullable=False,
        index=True,
    )

    # Banca organizadora (CESPE, FCC, FGV, VUNESP, etc.)
    exam_board = Column(String(100), nullable=True, index=True)
    exam_year = Column(Integer, nullable=True)
    exam_name = Column(String(255), nullable=True)   # Ex: "Concurso Delegado PCDF 2023"

    # Competência avaliada (habilidade ou conhecimento cobrado)
    competency = Column(String(255), nullable=True)

    # ── Gabarito e Justificativas ─────────────────────────────────────────────
    correct_alternative_key = Column(String(1), nullable=False)  # "a", "b", "c", "d", "e"

    # Explicação completa do porquê a resposta certa está correta
    correct_justification = Column(Text, nullable=True)

    # ── Status ────────────────────────────────────────────────────────────────
    is_active = Column(Boolean, default=True, nullable=False)
    # Indica se foi revisado por humano após extração do Gemini
    is_reviewed = Column(Boolean, default=False, nullable=False)

    # ── Estatísticas agregadas (atualizadas via Celery) ───────────────────────
    # Evitam recalcular na query a cada request
    total_attempts = Column(Integer, default=0, nullable=False)
    correct_attempts = Column(Integer, default=0, nullable=False)
    avg_response_time_seconds = Column(Float, default=0.0, nullable=False)

    # ── Relacionamentos ───────────────────────────────────────────────────────
    subject = relationship("Subject", back_populates="questions")
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

    @property
    def accuracy_rate(self) -> float:
        """Taxa de acerto geral da questão."""
        if self.total_attempts == 0:
            return 0.0
        return round(self.correct_attempts / self.total_attempts, 4)

    def __repr__(self):
        return f"<Question {self.id[:8]} [{self.difficulty}]>"


class Alternative(BaseModel, TenantMixin):
    """
    Alternativa de uma questão (a, b, c, d, e).
    Inclui justificativa do erro (distrator) — essencial para aprendizado.
    """
    __tablename__ = "alternatives"

    question_id = Column(UUID(as_uuid=False), ForeignKey("questions.id"), nullable=False)
    key = Column(String(1), nullable=False)    # "a", "b", "c", "d", "e"
    text = Column(Text, nullable=False)        # Texto da alternativa

    # Justificativa do distrator: explica EXATAMENTE qual foi o erro
    # Gerado pelo Gemini; pode ser null até o pipeline processar
    distractor_justification = Column(Text, nullable=True)

    question = relationship("Question", back_populates="alternatives")

    from sqlalchemy import UniqueConstraint
    __table_args__ = (
        UniqueConstraint("question_id", "key", name="uq_alternative_question_key"),
    )


class QuestionAttempt(BaseModel, TenantMixin):
    """
    Registro de cada vez que um aluno responde uma questão.

    Dados coletados:
    - Alternativa marcada
    - Se acertou
    - Tempo de resposta (mede velocidade e esforço)
    - Contexto (prática livre, simulado, cronograma)

    SEGURANÇA: Dados de tentativa são propriedade do tenant — nunca cruzados.
    """
    __tablename__ = "question_attempts"

    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    question_id = Column(UUID(as_uuid=False), ForeignKey("questions.id"), nullable=False)

    # Alternativa que o aluno marcou
    chosen_alternative_key = Column(String(1), nullable=False)
    is_correct = Column(Boolean, nullable=False)

    # Tempo de resposta em segundos (mede velocidade e esforço)
    response_time_seconds = Column(Integer, nullable=True)

    # Contexto da tentativa (para analytics segmentado)
    context = Column(
        String(50),
        default="practice",
        nullable=False,
    )
    # Valores: "practice" | "simulado" | "schedule" | "review"

    # ID do simulado se o contexto for "simulado"
    simulado_attempt_id = Column(
        UUID(as_uuid=False),
        ForeignKey("simulado_attempts.id"),
        nullable=True,
    )

    user = relationship("User", back_populates="question_attempts")
    question = relationship("Question", back_populates="attempts")


class QuestionTag(BaseModel, TenantMixin):
    """Tags customizadas por tenant para organização adicional de questões."""
    __tablename__ = "question_tags"

    question_id = Column(UUID(as_uuid=False), ForeignKey("questions.id"), nullable=False)
    tag = Column(String(100), nullable=False, index=True)

    question = relationship("Question", back_populates="tags")