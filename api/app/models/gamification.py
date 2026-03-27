# api/app/models/gamification.py
# Modelos para avaliação de aulas e gamificação (badges, patentes, mural de honra).

from sqlalchemy import Column, String, Text, Integer, Float, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import BaseModel, TenantMixin


# ══════════════════════════════════════════════════════════════════════════════
# AVALIAÇÃO DE AULAS
# ══════════════════════════════════════════════════════════════════════════════

class LessonRating(BaseModel, TenantMixin):
    """
    Avaliação de uma aula pelo aluno.
    1-5 estrelas + comentário opcional.
    Visível apenas para o produtor.
    """
    __tablename__ = "lesson_ratings"

    lesson_id = Column(UUID(as_uuid=False), ForeignKey("lessons.id"), nullable=False)
    user_id   = Column(UUID(as_uuid=False), ForeignKey("users.id"),   nullable=False)

    rating  = Column(Integer, nullable=False)        # 1 a 5
    comment = Column(Text,    nullable=True)

    # Insight gerado pelo Gemini quando aula acumula notas baixas
    ai_insight         = Column(Text,    nullable=True)
    ai_insight_version = Column(Integer, default=0, nullable=False)

    lesson = relationship("Lesson")
    user   = relationship("User")

    from sqlalchemy import UniqueConstraint
    __table_args__ = (
        UniqueConstraint("lesson_id", "user_id", name="uq_rating_lesson_user"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# GAMIFICAÇÃO — BADGES E PATENTES
# ══════════════════════════════════════════════════════════════════════════════

class StudentBadge(BaseModel, TenantMixin):
    """
    Badge conquistada por um aluno.
    Registra quando e qual badge foi desbloqueada.
    """
    __tablename__ = "student_badges"

    user_id    = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    badge_key  = Column(String(100), nullable=False)   # ex: "questions_100"
    earned_at  = Column(String(50),  nullable=False)   # ISO datetime

    user = relationship("User")

    from sqlalchemy import UniqueConstraint
    __table_args__ = (
        UniqueConstraint("user_id", "badge_key", "tenant_id", name="uq_student_badge"),
    )