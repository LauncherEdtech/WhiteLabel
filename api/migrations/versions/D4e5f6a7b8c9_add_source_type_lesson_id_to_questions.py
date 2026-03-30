"""add source_type and lesson_id to questions

Revision ID: d4e5f6a7b8c9
Revises: b3f7c2e8d541
Create Date: 2026-03-29 00:00:00.000000

Separa questões de concurso (bank) das questões geradas por IA a partir
de aulas (lesson). Questões de aula ficam vinculadas à lesson_id e
aparecem apenas na página daquela aula — nunca no banco geral nem em simulados.
"""

from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "b3f7c2e8d541"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Cria o tipo Enum no PostgreSQL
    op.execute("CREATE TYPE question_source_type AS ENUM ('bank', 'lesson')")

    # 2. Adiciona coluna source_type com default "bank" (todas as existentes são do banco)
    op.add_column(
        "questions",
        sa.Column(
            "source_type",
            sa.Enum("bank", "lesson", name="question_source_type"),
            nullable=False,
            server_default="bank",
        ),
    )

    # 3. Adiciona lesson_id (nullable — só preenchido quando source_type="lesson")
    op.add_column(
        "questions",
        sa.Column(
            "lesson_id",
            sa.String(36),
            sa.ForeignKey("lessons.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )

    # 4. Índice para busca rápida de questões por aula
    op.create_index("ix_questions_lesson_id", "questions", ["lesson_id"])
    op.create_index("ix_questions_source_type", "questions", ["source_type"])


def downgrade():
    op.drop_index("ix_questions_lesson_id", table_name="questions")
    op.drop_index("ix_questions_source_type", table_name="questions")
    op.drop_column("questions", "lesson_id")
    op.drop_column("questions", "source_type")
    op.execute("DROP TYPE question_source_type")
