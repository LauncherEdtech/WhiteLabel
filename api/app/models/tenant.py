# api/app/models/tenant.py
from sqlalchemy import Column, String, Boolean, JSON
from sqlalchemy.orm import relationship
from .base import BaseModel


class Tenant(BaseModel):
    __tablename__ = "tenants"

    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    custom_domain = Column(String(255), unique=True, nullable=True, index=True)
    domain_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    plan = Column(String(50), default="basic", nullable=False)

    branding = Column(
        JSON,
        default=lambda: {
            "primary_color": "#4F46E5",
            "secondary_color": "#10B981",
            "logo_url": None,
            "favicon_url": None,
            "platform_name": "Plataforma de Estudos",
            "support_email": None,
            "capsule_style": "operativo",
        },
        nullable=False,
    )

    features = Column(
        JSON,
        default=lambda: {
            "ai_schedule": True,
            "ai_question_extract": True,
            "simulados": True,
            "analytics_producer": True,
            "ai_tutor_chat": True,
            "question_bank_concursos": False,
        },
        nullable=False,
    )

    settings = Column(
        JSON,
        default=lambda: {
            "timezone": "America/Sao_Paulo",
            "default_language": "pt-BR",
            "max_students": 10000,
            "session_duration_hours": 1,
            # Tema da linguagem dos insights gerados pelo Gemini.
            # Valores: "militar" | "policial" | "juridico" | "fiscal" | "administrativo" | "saude"
            "insight_theme": "militar",
            # Tema da hierarquia de patentes na gamificação.
            "gamification_theme": "militar",
        },
        nullable=False,
    )

    users = relationship(
        "User", back_populates="tenant", lazy="dynamic", cascade="all, delete-orphan"
    )
    courses = relationship(
        "Course", back_populates="tenant", lazy="dynamic", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Tenant {self.slug}>"

    def is_feature_enabled(self, feature: str) -> bool:
        return bool(self.features.get(feature, False))

    def get_setting(self, key: str, default=None):
        return (self.settings or {}).get(key, default)
