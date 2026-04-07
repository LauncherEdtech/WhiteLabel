# api/app/models/tenant.py
# Tenant = cada infoprodutor/empresa na plataforma white-label.
# SEGURANÇA: O tenant é a unidade de isolamento central de todos os dados.

from sqlalchemy import Column, String, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from .base import BaseModel


class Tenant(BaseModel):
    """
    Representa um infoprodutor (cliente da plataforma white-label).

    Cada tenant tem:
    - Domínio próprio (ex: alunos.cursojuridico.com.br)
    - Branding personalizado (logo, cores)
    - Dados completamente isolados dos outros tenants
    - Configurações de features habilitadas
    """

    __tablename__ = "tenants"

    # ── Identificação ─────────────────────────────────────────────────────────
    name = Column(String(255), nullable=False)
    slug = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    # ── Domínio customizado ───────────────────────────────────────────────────
    custom_domain = Column(String(255), unique=True, nullable=True, index=True)
    domain_verified = Column(Boolean, default=False, nullable=False)

    # ── Status ────────────────────────────────────────────────────────────────
    is_active = Column(Boolean, default=True, nullable=False)
    plan = Column(String(50), default="basic", nullable=False)

    # ── Branding ──────────────────────────────────────────────────────────────
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

    # ── Features ──────────────────────────────────────────────────────────────
    # Adicione features aqui e em is_feature_enabled() ao criar novas.
    # Valores ausentes no JSON são tratados como False pelo is_feature_enabled.
    features = Column(
        JSON,
        default=lambda: {
            "ai_schedule": True,  # Cronograma inteligente
            "ai_question_extract": True,  # Extração de questões com Gemini
            "simulados": True,
            "analytics_producer": True,
            "ai_tutor_chat": True,
            # ── Banco de Questões Compartilhado ──────────────────────────────
            # Dá acesso ao banco global de questões de concurso.
            # Com esta feature o produtor também pode submeter novas questões
            # para revisão pelo admin.
            "question_bank_concursos": False,  # Desabilitado por padrão
        },
        nullable=False,
    )

    # ── Configurações operacionais ────────────────────────────────────────────
    settings = Column(
        JSON,
        default=lambda: {
            "timezone": "America/Sao_Paulo",
            "default_language": "pt-BR",
            "max_students": 10000,
            "session_duration_hours": 1,
        },
        nullable=False,
    )

    # ── Relacionamentos ───────────────────────────────────────────────────────
    users = relationship(
        "User",
        back_populates="tenant",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    courses = relationship(
        "Course",
        back_populates="tenant",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<Tenant {self.slug}>"

    def is_feature_enabled(self, feature: str) -> bool:
        """
        Verifica se uma feature está habilitada para este tenant.
        Valores ausentes no JSON retornam False (safe default).
        """
        return bool(self.features.get(feature, False))
