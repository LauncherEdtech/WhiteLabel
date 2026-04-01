# api/app/models/schedule.py
# Cronograma de estudos inteligente e adaptativo.
# Motor de adaptação roda via Celery; modelo apenas armazena o estado.

from sqlalchemy import Column, String, Text, Boolean, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import BaseModel, TenantMixin


class StudySchedule(BaseModel, TenantMixin):
    """
    Cronograma de estudos de um aluno para um curso.
    Gerado e atualizado pela IA com base em:
    - Disponibilidade declarada pelo aluno
    - Performance em questões (pontos fortes/fracos)
    - Progresso nas aulas (check-ins)
    - Detecção de abandono/atraso
    """
    __tablename__ = "study_schedules"

    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    course_id = Column(UUID(as_uuid=False), ForeignKey("courses.id"), nullable=False)

    # Status geral do cronograma
    status = Column(
        String(30),
        default="active",
        nullable=False,
    )
    # Valores: "active" | "paused" | "reorganizing" | "completed"

    # Data alvo para conclusão do curso (ex: data da prova)
    target_date = Column(String(10), nullable=True)   # ISO date: "2025-08-15"

    # Configuração atual de disponibilidade (pode diferir da declarada — adaptação)
    availability_snapshot = Column(JSON, default=dict, nullable=False)

    # Score de risco de abandono (0.0 = ok, 1.0 = alto risco)
    # Calculado pelo Celery periodicamente com base em padrões de acesso
    abandonment_risk_score = Column(Float, default=0.0, nullable=False)

    # Última vez que a IA reorganizou o cronograma
    last_reorganized_at = Column(String(50), nullable=True)   # ISO datetime


    # Notas da IA sobre o plano atual (visível apenas para o produtor)
    ai_notes = Column(Text, nullable=True)
    # ── NOVOS CAMPOS ──────────────────────────────────────────────────────────
    source_type = Column(
        String(30),
        default="ai",
        nullable=False,
    )
    # Valores: "ai" | "producer_template"
 
    template_id = Column(
        UUID(as_uuid=False),
        ForeignKey("producer_schedule_templates.id"),
        nullable=True,
    )
    # ─────────────────────────────────────────────────────────────────────────
    user = relationship("User")
    course = relationship("Course")
    items = relationship(
        "ScheduleItem",
        back_populates="schedule",
        cascade="all, delete-orphan",
        order_by="ScheduleItem.scheduled_date, ScheduleItem.order",
    )

    from sqlalchemy import UniqueConstraint
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_schedule_user_course"),
    )


class ScheduleItem(BaseModel, TenantMixin):
    """
    Item individual do cronograma: uma tarefa para um dia específico.
    Pode ser: assistir aula, praticar questões, revisar tema, fazer simulado.
    """
    __tablename__ = "schedule_items"

    schedule_id = Column(UUID(as_uuid=False), ForeignKey("study_schedules.id"), nullable=False)

    # Tipo de atividade
    item_type = Column(
        String(30),
        nullable=False,
    )
    # Valores: "lesson" | "questions" | "review" | "simulado"

    # Referências ao conteúdo (nullable dependendo do tipo)
    lesson_id = Column(UUID(as_uuid=False), ForeignKey("lessons.id"), nullable=True)
    subject_id = Column(UUID(as_uuid=False), ForeignKey("subjects.id"), nullable=True)

    # Quando está agendado
    scheduled_date = Column(String(10), nullable=False, index=True)  # ISO date
    order = Column(Integer, default=0, nullable=False)  # Ordem no dia

    # Carga estimada
    estimated_minutes = Column(Integer, default=30, nullable=False)

    # Motivo da inclusão (priorização da IA)
    priority_reason = Column(String(255), nullable=True)
    # Ex: "Baixa taxa de acerto em Direito Penal (45%)"

    # Status de conclusão
    status = Column(String(20), default="pending", nullable=False)
    # Valores: "pending" | "done" | "skipped" | "rescheduled"
    # Filtros para itens de questões/revisão do template do produtor
    # Estrutura: { "tags": [...], "difficulty": "...", "quantity": 10 }
    question_filters = Column(JSON, nullable=True)
 
    # Título e notas herdados do template do produtor (exibidos ao aluno)
    template_item_title = Column(String(255), nullable=True)
    template_item_notes = Column(Text, nullable=True)
    # ─────────────────────────────────────────────────────────────────────────
    schedule = relationship("StudySchedule", back_populates="items")
    lesson = relationship("Lesson")
    subject = relationship("Subject")
    checkin = relationship(
        "ScheduleCheckIn",
        back_populates="item",
        uselist=False,
    )


class ScheduleCheckIn(BaseModel, TenantMixin):
    """
    Check-in do aluno em um item do cronograma.
    O aluno confirma: assistiu a aula? fez as questões?
    Fonte de dados primária para adaptação do cronograma.
    """
    __tablename__ = "schedule_checkins"

    item_id = Column(UUID(as_uuid=False), ForeignKey("schedule_items.id"), nullable=False, unique=True)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)

    # O que o aluno informou
    completed = Column(Boolean, nullable=False)   # True = fez | False = não fez
    # Nota pessoal do aluno (opcional)
    note = Column(String(500), nullable=True)
    # Dificuldade percebida pelo aluno (feedback qualitativo)
    perceived_difficulty = Column(
        String(20),
        nullable=True,
    )
    # Valores: "easy" | "ok" | "hard"

    checked_in_at = Column(String(50), nullable=False)  # ISO datetime

    item = relationship("ScheduleItem", back_populates="checkin")
    user = relationship("User")