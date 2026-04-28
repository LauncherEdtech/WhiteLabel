"""add user_event_daily_rollup table

Revision ID: d8e5b3f7a912
Revises: e7c1a9b2d4f8
Create Date: 2026-04-28 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "d8e5b3f7a912"
down_revision = "e7c1a9b2d4f8"  # user_events table (rev anterior)
branch_labels = None
depends_on = None


def upgrade():
    # Idempotente — se rodar 2x ou se a tabela foi criada manualmente, não falha
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_event_daily_rollup (
            id UUID NOT NULL,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            rollup_date DATE NOT NULL,
            event_type VARCHAR(50) NOT NULL,
            feature_name VARCHAR(50),
            total_count INTEGER NOT NULL DEFAULT 0,
            unique_users INTEGER NOT NULL DEFAULT 0,
            unique_sessions INTEGER NOT NULL DEFAULT 0,
            metadata_summary JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id),
            CONSTRAINT uq_rollup_key UNIQUE (tenant_id, rollup_date, event_type, feature_name)
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_rollup_tenant_date ON user_event_daily_rollup (tenant_id, rollup_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_rollup_tenant_event_date ON user_event_daily_rollup (tenant_id, event_type, rollup_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_rollup_tenant_feature_date ON user_event_daily_rollup (tenant_id, feature_name, rollup_date)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS user_event_daily_rollup CASCADE")