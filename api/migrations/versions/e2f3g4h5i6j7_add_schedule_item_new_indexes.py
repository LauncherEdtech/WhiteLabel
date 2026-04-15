"""add schedule item new indexes

Revision ID: e2f3g4h5i6j7
Revises: d1e2f3g4h5i6
Create Date: 2026-04-14 20:30:00.000000

"""
from alembic import op

revision = 'e2f3g4h5i6j7'
down_revision = 'd1e2f3g4h5i6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        'ix_schedule_items_dates_deleted',
        'schedule_items',
        ['schedule_id', 'scheduled_date', 'is_deleted'],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        'ix_schedule_items_lessons',
        'schedule_items',
        ['item_type', 'lesson_id', 'is_deleted'],
        unique=False,
        if_not_exists=True,
    )


def downgrade():
    op.drop_index('ix_schedule_items_lessons', table_name='schedule_items', if_exists=True)
    op.drop_index('ix_schedule_items_dates_deleted', table_name='schedule_items', if_exists=True)