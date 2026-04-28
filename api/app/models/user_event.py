# api/app/models/user_event.py
# Registra eventos comportamentais dos usuários para análise de uso.
#
# DESIGN — divergente do BaseModel padrão por motivos de performance:
# - NÃO herda BaseModel: eventos são imutáveis e em alto volume.
#   Não faz sentido ter updated_at/is_deleted/deleted_at consumindo I/O.
# - Hard delete via job Celery noturno (retenção 365 dias — passo 4).
# - JSONB em event_metadata permite filtros eficientes via GIN se necessário.
#
# COMPATIBILIDADE TESTES:
# - Em produção (Postgres) usa JSONB.
# - Em testes (SQLite) cai automaticamente para JSON via with_variant.
# - O banco real (RDS) já está com JSONB — variant só afeta create_all() em testes.
#
# SEGURANÇA:
# - tenant_id e user_id sempre vêm do JWT — cliente nunca os envia no payload.
# - event_type e feature_name validados contra whitelist no endpoint.
#
# PERFORMANCE:
# - 4 índices compostos cobrem 95% das queries do painel.

from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.extensions import db
from app.models.base import generate_uuid, TenantMixin


class UserEvent(db.Model, TenantMixin):
    __tablename__ = "user_events"

    id = Column(
        UUID(as_uuid=False),
        primary_key=True,
        default=generate_uuid,
        nullable=False,
    )

    user_id = Column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # session_id é gerado pelo cliente (UUID); não é FK — sessões não persistem
    session_id = Column(UUID(as_uuid=False), nullable=False)

    # Tipo do evento (ex: "page_view", "mentor_click") — whitelist no endpoint
    event_type = Column(String(50), nullable=False)

    # Feature relacionada (ex: "mentor", "simulados") — whitelist no endpoint
    feature_name = Column(String(50), nullable=True)

    # ID do recurso afetado (lesson_id, question_id, simulado_id, etc.)
    target_id = Column(UUID(as_uuid=False), nullable=True)

    # Metadados livres do evento — limitado a 2 KB no endpoint.
    # Nome `event_metadata` (não `metadata`) porque `metadata` é reservado em SQLAlchemy.
    # JSONB em Postgres (produção) e JSON em SQLite (testes) — variant transparente.
    event_metadata = Column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )

    # Quando o evento aconteceu no cliente (pode estar fora de ordem do server)
    client_timestamp = Column(DateTime(timezone=True), nullable=True)

    # Quando o servidor recebeu — ordem canônica
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        # Filtros do painel: eventos por feature/tipo num período
        Index("ix_events_tenant_type_time", "tenant_id", "event_type", "created_at"),
        # Drill-down por aluno
        Index("ix_events_tenant_user_time", "tenant_id", "user_id", "created_at"),
        # Heatmap por feature
        Index("ix_events_tenant_feature_time", "tenant_id", "feature_name", "created_at"),
        # Reconstrução de sessão
        Index("ix_events_tenant_session", "tenant_id", "session_id"),
    )

    def __repr__(self):
        return f"<UserEvent {self.event_type} user={self.user_id}>"