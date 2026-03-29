# api/app/models/course.py
# Hierarquia de conteúdo: Course > Subject > Module > Lesson
# Cada nível pertence a um tenant (isolamento garantido).

from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import BaseModel, TenantMixin


class Course(BaseModel, TenantMixin):
    """
    Curso principal do infoprodutor.
    Ex: "Aprovação PCDF 2025 - Delegado"
    """

    __tablename__ = "courses"

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Configurações do curso (carga horária total esperada, etc.)
    settings = Column(JSON, default=dict, nullable=False)

    # ── Relacionamentos ───────────────────────────────────────────────────────
    tenant = relationship("Tenant", back_populates="courses")
    subjects = relationship(
        "Subject",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="Subject.order",
    )
    students = relationship(
        "CourseEnrollment",
        back_populates="course",
        lazy="dynamic",
    )

    def __repr__(self):
        return f"<Course {self.name}>"


class CourseEnrollment(BaseModel, TenantMixin):
    """Matrícula de aluno em um curso."""

    __tablename__ = "course_enrollments"

    course_id = Column(UUID(as_uuid=False), ForeignKey("courses.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    course = relationship("Course", back_populates="students")
    user = relationship("User")

    from sqlalchemy import UniqueConstraint

    __table_args__ = (
        UniqueConstraint("course_id", "user_id", name="uq_enrollment_course_user"),
    )


class Subject(BaseModel, TenantMixin):
    """
    Disciplina dentro do curso.
    Ex: "Direito Penal", "Português", "Raciocínio Lógico"
    """

    __tablename__ = "subjects"

    course_id = Column(UUID(as_uuid=False), ForeignKey("courses.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order = Column(Integer, default=0, nullable=False)
    color = Column(String(7), default="#4F46E5", nullable=False)  # Hex color para UI

    # Peso da disciplina no edital (usado pelo cronograma inteligente)
    edital_weight = Column(Float, default=1.0, nullable=False)

    course = relationship("Course", back_populates="subjects")
    modules = relationship(
        "Module",
        back_populates="subject",
        cascade="all, delete-orphan",
        order_by="Module.order",
    )
    questions = relationship("Question", back_populates="subject", lazy="dynamic")


class Module(BaseModel, TenantMixin):
    """
    Módulo/Tópico dentro de uma disciplina.
    Ex: "Crimes contra a pessoa", "Ortografia"
    """

    __tablename__ = "modules"

    subject_id = Column(UUID(as_uuid=False), ForeignKey("subjects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order = Column(Integer, default=0, nullable=False)

    subject = relationship("Subject", back_populates="modules")
    lessons = relationship(
        "Lesson",
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="Lesson.order",
    )


class Lesson(BaseModel, TenantMixin):
    """
    Aula dentro de um módulo.
    Pode ter vídeo, material PDF, e metadados para o cronograma.
    """

    __tablename__ = "lessons"

    module_id = Column(UUID(as_uuid=False), ForeignKey("modules.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order = Column(Integer, default=0, nullable=False)

    # Conteúdo
    video_url = Column(String(500), nullable=True)  # URL S3 ou embed YouTube/Vimeo
    duration_minutes = Column(Integer, default=0, nullable=False)
    material_url = Column(String(500), nullable=True)  # PDF de apoio
    video_s3_key = Column(String(500), nullable=True)  # Key S3 — hospedagem nativa

    # Link externo para aulas hospedadas fora da plataforma (ex: Hotmart, Kiwify).
    # Quando preenchido, o aluno é redirecionado para esta URL em vez de
    # ver o player de vídeo interno.
    external_url = Column(String(500), nullable=True)

    # IA: resumo gerado pelo Gemini (pipeline assíncrono)
    ai_summary = Column(Text, nullable=True)
    ai_topics = Column(
        JSON, default=list, nullable=False
    )  # ["habeas corpus", "prisão preventiva"]
    ai_processed_at = Column(String(50), nullable=True)  # ISO datetime

    is_published = Column(Boolean, default=False, nullable=False)
    is_free_preview = Column(Boolean, default=False, nullable=False)

    module = relationship("Module", back_populates="lessons")
    progress_records = relationship(
        "LessonProgress",
        back_populates="lesson",
        lazy="dynamic",
    )


class LessonProgress(BaseModel, TenantMixin):
    """
    Registro de progresso do aluno em cada aula.
    Fonte de dados para o cronograma e analytics.
    """

    __tablename__ = "lesson_progress"

    lesson_id = Column(UUID(as_uuid=False), ForeignKey("lessons.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)

    # Check-in: aluno confirma se assistiu ou não
    status = Column(
        String(20),
        default="not_started",
        nullable=False,
    )
    # Valores possíveis: not_started | watched | not_watched | partial

    watch_percentage = Column(Float, default=0.0, nullable=False)  # 0.0 a 1.0
    last_watched_at = Column(String(50), nullable=True)  # ISO datetime

    lesson = relationship("Lesson", back_populates="progress_records")
    user = relationship("User", back_populates="lesson_progress")

    from sqlalchemy import UniqueConstraint

    __table_args__ = (
        UniqueConstraint("lesson_id", "user_id", name="uq_progress_lesson_user"),
    )
