# api/app/models/user.py
# Usuários da plataforma: super_admin, producer_admin, producer_staff, student.
# SEGURANÇA: Senhas nunca armazenadas em texto plano. Bcrypt com cost factor 12.

import bcrypt
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Boolean, JSON, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import BaseModel, TenantMixin


class UserRole(str, PyEnum):
    """
    Papéis com permissões crescentes.
    SEGURANÇA: Verificação de role sempre server-side, nunca confiar no cliente.
    """

    SUPER_ADMIN = "super_admin"  # Acesso total à plataforma (você)
    PRODUCER_ADMIN = "producer_admin"  # Dono do tenant (infoprodutor)
    PRODUCER_STAFF = "producer_staff"  # Equipe do infoprodutor (suporte, tutor)
    STUDENT = "student"  # Aluno comprador do curso


class User(BaseModel, TenantMixin):
    """
    Usuário da plataforma.

    SEGURANÇA:
    - Senha em bcrypt (hash + salt automático)
    - tenant_id isola dados por produtor
    - Tokens de reset de senha com expiração
    - Tentativas de login limitadas (rate limiter nas rotas)
    """

    __tablename__ = "users"

    # ── Identificação ─────────────────────────────────────────────────────────
    email = Column(String(255), nullable=False, index=True)
    # SEGURANÇA: email único POR TENANT (mesmo email pode existir em tenants diferentes)
    __table_args__ = (
        db_unique_constraint := None,  # Definido abaixo via __table_args__
    )

    name = Column(String(255), nullable=False)
    # SEGURANÇA: Senha nunca em texto plano — apenas o hash bcrypt
    password_hash = Column(String(255), nullable=False)

    # ── Papel e Status ────────────────────────────────────────────────────────
    role = Column(
        Enum(UserRole, name="user_role_enum"),
        nullable=False,
        default=UserRole.STUDENT,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)

    # ── Recuperação de senha ──────────────────────────────────────────────────
    # SEGURANÇA: Token armazenado como hash, não em texto plano
    reset_token_hash = Column(String(255), nullable=True)
    reset_token_expires_at = Column(String(50), nullable=True)  # ISO datetime string

    # ── Verificação de e-mail ─────────────────────────────────────────────────
    verification_token_hash = Column(String(255), nullable=True)

    # ── Preferências do aluno ─────────────────────────────────────────────────
    # JSON flexível: não precisa de migration para novos campos de preferência
    preferences = Column(
        JSON,
        default=lambda: {
            "timezone": "America/Sao_Paulo",
            "notifications_email": True,
            "notifications_push": True,
            "study_reminder_time": "08:00",  # Horário do lembrete diário
        },
        nullable=False,
    )

    # ── Disponibilidade de estudo (base para o cronograma inteligente) ─────────
    study_availability = Column(
        JSON,
        default=lambda: {
            # dias: 0=seg, 1=ter, ..., 6=dom
            "days": [0, 1, 2, 3, 4],
            "hours_per_day": 2,
            "preferred_start_time": "19:00",
        },
        nullable=True,
    )

    # ── Configurações internas (onboarding, flags, etc.) ──────────────────────────
    settings = Column(
        JSON,
        default=dict,
        nullable=True,
    )

    # ── Relacionamentos ───────────────────────────────────────────────────────
    tenant = relationship("Tenant", back_populates="users")
    lesson_progress = relationship(
        "LessonProgress",
        back_populates="user",
        lazy="dynamic",
    )
    question_attempts = relationship(
        "QuestionAttempt",
        back_populates="user",
        lazy="dynamic",
    )
    simulado_attempts = relationship(
        "SimuladoAttempt",
        back_populates="user",
        lazy="dynamic",
    )

    # SEGURANÇA: unique constraint composto (email + tenant_id)
    from sqlalchemy import UniqueConstraint

    __table_args__ = (
        UniqueConstraint("email", "tenant_id", name="uq_user_email_tenant"),
    )

    # ── Métodos de Senha ───────────────────────────────────────────────────────

    def set_password(self, password: str) -> None:
        """
        Gera hash bcrypt da senha.
        SEGURANÇA:
        - Cost factor 12 (balanceia segurança e performance)
        - Salt gerado automaticamente pelo bcrypt
        - Mínimo de 8 caracteres deve ser validado na rota ANTES de chamar isso
        """
        if len(password) < 8:
            raise ValueError("Senha deve ter no mínimo 8 caracteres.")
        password_bytes = password.encode("utf-8")
        salt = bcrypt.gensalt(rounds=12)
        self.password_hash = bcrypt.hashpw(password_bytes, salt).decode("utf-8")

    def check_password(self, password: str) -> bool:
        """
        Verifica senha contra o hash armazenado.
        SEGURANÇA: Comparação em tempo constante (bcrypt garante isso).
        """
        try:
            return bcrypt.checkpw(
                password.encode("utf-8"),
                self.password_hash.encode("utf-8"),
            )
        except Exception:
            # SEGURANÇA: Qualquer erro retorna False silenciosamente
            return False

    def has_role(self, *roles: UserRole) -> bool:
        """Verifica se o usuário tem um dos papéis especificados."""
        return self.role in roles

    def __repr__(self):
        return f"<User {self.email} [{self.role}]>"
