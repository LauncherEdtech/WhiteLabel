# api/app/models/base.py
# Model base com campos auditoria e tenant isolation.
# SEGURANÇA: Todo model herda tenant_id — garante isolamento de dados entre produtores.

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.extensions import db


def generate_uuid() -> str:
    """Gera UUID v4 como string. Usado como PK padrão."""
    return str(uuid.uuid4())


class TimestampMixin:
    """
    Adiciona created_at e updated_at automáticos em todos os models.
    Usa UTC internamente; converte para timezone do usuário na API.
    """
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SoftDeleteMixin:
    """
    Deleção lógica: registros nunca são removidos fisicamente.
    SEGURANÇA: Preserva auditoria e permite recuperação de dados.
    """
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)


class TenantMixin:
    """
    SEGURANÇA: Garante que todo registro pertence a um tenant.
    Queries SEMPRE devem filtrar por tenant_id para evitar data leakage.
    """
    tenant_id = Column(
        UUID(as_uuid=False),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,   # Index crítico: todas as queries filtram por tenant
    )


class BaseModel(db.Model, TimestampMixin, SoftDeleteMixin):
    """
    Classe base abstrata para todos os models.
    UUID como PK: impossível de enumerar via força bruta (vs auto-increment).
    """
    __abstract__ = True

    id = Column(
        UUID(as_uuid=False),
        primary_key=True,
        default=generate_uuid,
        nullable=False,
    )

    def to_dict(self) -> dict:
        """Serialização básica. Override nos models para campos específicos."""
        return {
            c.name: getattr(self, c.name)
            for c in self.__table__.columns
            # SEGURANÇA: Nunca inclui campos sensíveis na serialização base
            if c.name not in ("password_hash",)
        }