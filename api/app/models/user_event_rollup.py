# api/app/models/user_event_rollup.py
# Tabela de rollup diário de eventos para queries rápidas no painel admin.
#
# Por que existe:
#   user_events tem 1 linha por evento (50k+/dia em produção). Queries de
#   agregação ficam lentas em escala. Esta tabela é populada noturnamente
#   pelo job event_aggregation.py com 1 linha por (tenant, dia, event_type,
#   feature_name) — ~100 linhas/tenant/dia em vez de 50k.
#
# Não herda BaseModel:
#   - Não tem soft_delete (rollups são apagados ao recriar agregação)
#   - Tem updated_at próprio para idempotência

import uuid
from sqlalchemy import (
    Column, String, Integer, Date, DateTime, ForeignKey,
    UniqueConstraint, Index, func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.types import JSON

from app.extensions import db


class UserEventDailyRollup(db.Model):
    __tablename__ = "user_event_daily_rollup"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Chave de agregação
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    rollup_date = Column(Date, nullable=False)
    event_type = Column(String(50), nullable=False)
    feature_name = Column(String(50), nullable=True)

    # Contadores
    total_count = Column(Integer, nullable=False, default=0)
    unique_users = Column(Integer, nullable=False, default=0)
    unique_sessions = Column(Integer, nullable=False, default=0)

    # Distribuição agregada de metadata.
    # Ex: para "question_filter_used", guarda contagem por source:
    #   {"by_source": {"discipline_select": 234, "difficulty_button": 89}}
    # Tipo JSONB no Postgres + JSON no SQLite (testes)
    metadata_summary = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "rollup_date", "event_type", "feature_name",
            name="uq_rollup_key",
        ),
        Index("ix_rollup_tenant_date", "tenant_id", "rollup_date"),
        Index("ix_rollup_tenant_event_date", "tenant_id", "event_type", "rollup_date"),
        Index("ix_rollup_tenant_feature_date", "tenant_id", "feature_name", "rollup_date"),
    )

    def to_dict(self) -> dict:
        return {
            "tenant_id": str(self.tenant_id),
            "rollup_date": self.rollup_date.isoformat() if self.rollup_date else None,
            "event_type": self.event_type,
            "feature_name": self.feature_name,
            "total_count": self.total_count,
            "unique_users": self.unique_users,
            "unique_sessions": self.unique_sessions,
            "metadata_summary": self.metadata_summary or {},
        }