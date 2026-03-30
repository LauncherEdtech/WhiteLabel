"""add source_type and lesson_id to questions

Revision ID: d4e5f6a7b8c9
Revises: b3f7c2e8d541
Create Date: 2026-03-30 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "d4e5f6a7b8c9"
down_revision = "b3f7c2e8d541"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE TYPE question_source_type AS ENUM ('bank', 'lesson')")

    op.add_column(
        "questions",
        sa.Column(
            "source_type",
            sa.Enum("bank", "lesson", name="question_source_type"),
            nullable=False,
            server_default="bank",
        ),
    )

    op.add_column(
        "questions",
        sa.Column("lesson_id", UUID(as_uuid=False), nullable=True),
    )

    op.create_foreign_key(
        "fk_questions_lesson_id",
        "questions", "lessons",
        ["lesson_id"], ["id"],
        ondelete="CASCADE",
    )

    op.create_index("ix_questions_lesson_id", "questions", ["lesson_id"])
    op.create_index("ix_questions_source_type", "questions", ["source_type"])


def downgrade():
    op.drop_index("ix_questions_source_type", table_name="questions")
    op.drop_index("ix_questions_lesson_id", table_name="questions")
    op.drop_constraint("fk_questions_lesson_id", "questions", type_="foreignkey")
    op.drop_column("questions", "lesson_id")
    op.drop_column("questions", "source_type")
    op.execute("DROP TYPE question_source_type")
