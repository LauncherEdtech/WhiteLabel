"""add user events table

Revision ID: e7c1a9b2d4f8
Revises: f3g4h5i6j7k8
Create Date: 2026-04-28 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'e7c1a9b2d4f8'
down_revision = 'f3g4h5i6j7k8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'user_events',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('tenant_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('session_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('feature_name', sa.String(length=50), nullable=True),
        sa.Column('target_id', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('event_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('client_timestamp', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_index(
        'ix_user_events_tenant_id',
        'user_events',
        ['tenant_id'],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        'ix_events_tenant_type_time',
        'user_events',
        ['tenant_id', 'event_type', 'created_at'],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        'ix_events_tenant_user_time',
        'user_events',
        ['tenant_id', 'user_id', 'created_at'],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        'ix_events_tenant_feature_time',
        'user_events',
        ['tenant_id', 'feature_name', 'created_at'],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        'ix_events_tenant_session',
        'user_events',
        ['tenant_id', 'session_id'],
        unique=False,
        if_not_exists=True,
    )


def downgrade():
    op.drop_index('ix_events_tenant_session', table_name='user_events', if_exists=True)
    op.drop_index('ix_events_tenant_feature_time', table_name='user_events', if_exists=True)
    op.drop_index('ix_events_tenant_user_time', table_name='user_events', if_exists=True)
    op.drop_index('ix_events_tenant_type_time', table_name='user_events', if_exists=True)
    op.drop_index('ix_user_events_tenant_id', table_name='user_events', if_exists=True)
    op.drop_table('user_events')