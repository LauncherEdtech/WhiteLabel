"""add video_s3_key to lessons

Revision ID: b3f7c2e8d541
Revises: c3d4e5f6a7b8
Create Date: 2026-03-28
"""

from alembic import op
import sqlalchemy as sa

revision = "b3f7c2e8d541"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "lessons",
        sa.Column("video_s3_key", sa.String(500), nullable=True),
    )


def downgrade():
    op.drop_column("lessons", "video_s3_key")
