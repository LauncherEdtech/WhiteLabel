"""add gamification

Revision ID: b2c3d4e5f6a7
Revises: a6b9aff1dc50
Create Date: 2026-03-27 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a6b9aff1dc50'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('lesson_ratings',
        sa.Column('lesson_id',           sa.UUID(as_uuid=False), nullable=False),
        sa.Column('user_id',             sa.UUID(as_uuid=False), nullable=False),
        sa.Column('rating',              sa.Integer(),           nullable=False),
        sa.Column('comment',             sa.Text(),              nullable=True),
        sa.Column('ai_insight',          sa.Text(),              nullable=True),
        sa.Column('ai_insight_version',  sa.Integer(),           nullable=False, server_default='0'),
        sa.Column('id',         sa.UUID(as_uuid=False),          nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),      nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),      nullable=False),
        sa.Column('is_deleted', sa.Boolean(),                    nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True),      nullable=True),
        sa.Column('tenant_id',  sa.UUID(as_uuid=False),          nullable=False),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id']),
        sa.ForeignKeyConstraint(['user_id'],   ['users.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lesson_id', 'user_id', name='uq_rating_lesson_user'),
    )
    op.create_index('ix_lesson_ratings_tenant_id', 'lesson_ratings', ['tenant_id'])

    op.create_table('student_badges',
        sa.Column('user_id',   sa.UUID(as_uuid=False), nullable=False),
        sa.Column('badge_key', sa.String(length=100),  nullable=False),
        sa.Column('earned_at', sa.String(length=50),   nullable=False),
        sa.Column('id',         sa.UUID(as_uuid=False),     nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(),               nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('tenant_id',  sa.UUID(as_uuid=False),     nullable=False),
        sa.ForeignKeyConstraint(['user_id'],   ['users.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'badge_key', 'tenant_id', name='uq_student_badge'),
    )
    op.create_index('ix_student_badges_tenant_id', 'student_badges', ['tenant_id'])


def downgrade():
    op.drop_index('ix_student_badges_tenant_id', table_name='student_badges')
    op.drop_table('student_badges')
    op.drop_index('ix_lesson_ratings_tenant_id', table_name='lesson_ratings')
    op.drop_table('lesson_ratings')
