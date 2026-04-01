# api/app/models/producer_schedule.py
# Modelo de cronograma pré-definido pelo infoprodutor para um curso.
#
# Hierarquia:
#   ProducerScheduleTemplate (1 por curso)
#     └─ ProducerScheduleTemplateItem[] (itens ordenados por day_number + order)
#
# Cada item pode ser:
#   "lesson"    → aula específica do curso
#   "questions" → sessão de questões com filtros pré-setados
#   "review"    → revisão de disciplina com filtros pré-setados
#   "simulado"  → simulado livre (sem filtros)

from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import BaseModel, TenantMixin


class ProducerScheduleTemplate(BaseModel, TenantMixin):
    """
    Template de cronograma criado pelo infoprodutor para um curso.
    Um curso pode ter no máximo 1 template ativo.

    Fluxo:
      1. Produtor cria template e adiciona itens.
      2. Aluno vê opção "Seguir cronograma do professor" na tela de cronograma.
      3. Ao adotar, um StudySchedule é gerado a partir deste template.
    """

    __tablename__ = "producer_schedule_templates"

    course_id = Column(
        UUID(as_uuid=False), ForeignKey("courses.id"), nullable=False, unique=True
    )

    title = Column(String(255), nullable=False, default="Cronograma do Curso")
    description = Column(Text, nullable=True)

    # Permite que o aluno ignore o template e crie seu próprio cronograma IA
    allow_student_custom_schedule = Column(Boolean, default=True, nullable=False)

    # Indica se o template está publicado (visível para os alunos)
    is_published = Column(Boolean, default=False, nullable=False)

    # Total de dias do template (calculado automaticamente)
    total_days = Column(Integer, default=0, nullable=False)

    course = relationship("Course", backref="schedule_template")
    items = relationship(
        "ProducerScheduleTemplateItem",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="ProducerScheduleTemplateItem.day_number, ProducerScheduleTemplateItem.order",
    )


class ProducerScheduleTemplateItem(BaseModel, TenantMixin):
    """
    Item individual do template do produtor.
    Cada item pertence a um dia (day_number) e tem uma ordem dentro do dia.
    """

    __tablename__ = "producer_schedule_template_items"

    template_id = Column(
        UUID(as_uuid=False),
        ForeignKey("producer_schedule_templates.id"),
        nullable=False,
    )

    # Dia no cronograma (começa em 1)
    day_number = Column(Integer, nullable=False)
    # Posição dentro do dia
    order = Column(Integer, default=0, nullable=False)

    # Tipo de atividade
    item_type = Column(
        String(30),
        nullable=False,
    )
    # Valores: "lesson" | "questions" | "review" | "simulado"

    # Título customizável (ex: "Revisão de Direito Constitucional")
    title = Column(String(255), nullable=True)

    # Nota opcional do produtor para o aluno
    notes = Column(Text, nullable=True)

    # ── Referências de conteúdo (nullable segundo o tipo) ─────────────────────

    # Para item_type="lesson": aula específica
    lesson_id = Column(UUID(as_uuid=False), ForeignKey("lessons.id"), nullable=True)

    # Para item_type="questions" | "review": disciplina base
    subject_id = Column(UUID(as_uuid=False), ForeignKey("subjects.id"), nullable=True)

    # Duração estimada em minutos
    estimated_minutes = Column(Integer, default=30, nullable=False)

    # ── Filtros de questões (para tipos "questions" e "review") ───────────────
    # Estrutura: {
    #   "tags": ["tag1", "tag2"],          (tópicos/assuntos)
    #   "difficulty": "medium",            (easy|medium|hard|expert)
    #   "quantity": 10,                    (qtd de questões)
    # }
    question_filters = Column(JSON, nullable=True)

    template = relationship("ProducerScheduleTemplate", back_populates="items")
    lesson = relationship("Lesson")
    subject = relationship("Subject")
