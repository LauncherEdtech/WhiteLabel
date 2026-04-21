"""add gemini_enriched to questions

Revision ID: f3g4h5i6j7k8
Revises: e2f3g4h5i6j7
Create Date: 2026-04-21 00:00:00.000000

Adiciona flag gemini_enriched à tabela questions.
- False (default): questão ainda não foi processada pelo Gemini
- True: questão tem tópico, dica e distratores preenchidos pelo Gemini

Backfill: questões já existentes com tip preenchido são marcadas
como enriched para não quebrar o banco atual.
"""

from alembic import op
import sqlalchemy as sa

revision = "f3g4h5i6j7k8"
down_revision = "e2f3g4h5i6j7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "questions",
        sa.Column(
            "gemini_enriched",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )

    op.create_index(
        "ix_questions_gemini_enriched",
        "questions",
        ["gemini_enriched"],
        unique=False,
    )

    # Backfill: marca como enriched questões que já têm tip preenchido
    # (foram processadas pelo Gemini em sessões anteriores)
    op.execute(
        """
        UPDATE questions
        SET gemini_enriched = true
        WHERE tip IS NOT NULL AND tip != ''
        """
    )

    # Também marca questões criadas manualmente pelo produtor com dados completos
    # (is_reviewed=true + correct_justification preenchida) — elas não passam
    # pelo Gemini mas já têm qualidade suficiente para aparecer no banco
    op.execute(
        """
        UPDATE questions
        SET gemini_enriched = true
        WHERE is_reviewed = true
          AND correct_justification IS NOT NULL
          AND correct_justification != ''
          AND tenant_id IS NOT NULL
        """
    )


def downgrade():
    op.drop_index("ix_questions_gemini_enriched", table_name="questions")
    op.drop_column("questions", "gemini_enriched")