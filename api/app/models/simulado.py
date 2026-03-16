# api/app/models/simulado.py
# Simulados: provas completas com tempo limitado e feedback detalhado.

from sqlalchemy import Column, String, Text, Boolean, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import BaseModel, TenantMixin


class Simulado(BaseModel, TenantMixin):
    """
    Template de simulado criado pelo produtor.
    Define: quais questões, tempo total, configurações de resultado.
    """
    __tablename__ = "simulados"

    course_id = Column(UUID(as_uuid=False), ForeignKey("courses.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Tempo total em minutos (ex: 60, 180, 240)
    time_limit_minutes = Column(Integer, nullable=False)

    # Configurações
    settings = Column(
        JSON,
        default=lambda: {
            "shuffle_questions": True,    # Embaralha questões
            "shuffle_alternatives": True, # Embaralha alternativas
            "show_result_immediately": True,
            "passing_score": 0.6,         # 60% para aprovação
        },
        nullable=False,
    )

    is_active = Column(Boolean, default=True, nullable=False)
    # Simulado gerado automaticamente pela IA (vs criado manualmente)
    is_ai_generated = Column(Boolean, default=False, nullable=False)

    course = relationship("Course")
    questions = relationship(
        "SimuladoQuestion",
        back_populates="simulado",
        cascade="all, delete-orphan",
        order_by="SimuladoQuestion.order",
    )
    attempts = relationship(
        "SimuladoAttempt",
        back_populates="simulado",
        lazy="dynamic",
    )


class SimuladoQuestion(BaseModel, TenantMixin):
    """Questão incluída em um simulado (com ordem específica)."""
    __tablename__ = "simulado_questions"

    simulado_id = Column(UUID(as_uuid=False), ForeignKey("simulados.id"), nullable=False)
    question_id = Column(UUID(as_uuid=False), ForeignKey("questions.id"), nullable=False)
    order = Column(Integer, default=0, nullable=False)

    # Tempo específico para esta questão no simulado (opcional)
    time_limit_seconds = Column(Integer, nullable=True)

    simulado = relationship("Simulado", back_populates="questions")
    question = relationship("Question")


class SimuladoAttempt(BaseModel, TenantMixin):
    """
    Tentativa de um aluno em um simulado.
    Registra: início, fim, respostas, score final, performance por matéria.
    """
    __tablename__ = "simulado_attempts"

    simulado_id = Column(UUID(as_uuid=False), ForeignKey("simulados.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)

    # Timestamps ISO
    started_at = Column(String(50), nullable=False)
    finished_at = Column(String(50), nullable=True)   # Null enquanto em andamento
    # SEGURANÇA: Validar server-side que tempo_gasto <= time_limit_minutes

    # Resultados
    score = Column(Float, nullable=True)              # 0.0 a 1.0
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    total_time_seconds = Column(Integer, nullable=True)  # Tempo real gasto

    # Performance por disciplina (calculado ao finalizar)
    # Ex: {"Direito Penal": {"correct": 8, "total": 10, "score": 0.8}}
    subject_performance = Column(JSON, default=dict, nullable=False)

    # Status
    status = Column(
        String(20),
        default="in_progress",
        nullable=False,
    )
    # Valores: "in_progress" | "completed" | "timed_out" | "abandoned"

    simulado = relationship("Simulado", back_populates="attempts")
    user = relationship("User", back_populates="simulado_attempts")
    answers = relationship(
        "SimuladoAnswer",
        back_populates="attempt",
        cascade="all, delete-orphan",
    )


class SimuladoAnswer(BaseModel, TenantMixin):
    """Resposta individual do aluno em uma questão do simulado."""
    __tablename__ = "simulado_answers"

    attempt_id = Column(UUID(as_uuid=False), ForeignKey("simulado_attempts.id"), nullable=False)
    question_id = Column(UUID(as_uuid=False), ForeignKey("questions.id"), nullable=False)

    chosen_alternative_key = Column(String(1), nullable=True)  # Null = pulou
    is_correct = Column(Boolean, nullable=True)
    response_time_seconds = Column(Integer, nullable=True)

    attempt = relationship("SimuladoAttempt", back_populates="answers")
    question = relationship("Question")