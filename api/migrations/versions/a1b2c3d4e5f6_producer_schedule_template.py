"""producer schedule template

Revision ID: a1b2c3d4e5f6
Revises: d4e5f6a7b8c9
Create Date: 2026-03-31

ANTES DE RODAR:
  Execute: flask db heads
  Substitua d4e5f6a7b8c9 pelo revision ID retornado.

  Depois rode via ECS (conforme workflow padrão do projeto):
    aws ecs run-task --cluster concurso-platform-cluster ...
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers
revision = "a1b2c3d4e5f6"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None

def upgrade():
    # ── 1. Tabela de templates do produtor ────────────────────────────────────
    op.create_table(
        "producer_schedule_templates",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=False), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("course_id", UUID(as_uuid=False), sa.ForeignKey("courses.id"), nullable=False, unique=True),
        sa.Column("title", sa.String(255), nullable=False, server_default="Cronograma do Curso"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("allow_student_custom_schedule", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_published", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("total_days", sa.Integer, nullable=False, server_default="0"),
        # BaseModel fields
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_prod_sched_tmpl_course", "producer_schedule_templates", ["course_id"])
    op.create_index("ix_prod_sched_tmpl_tenant", "producer_schedule_templates", ["tenant_id"])

    # ── 2. Tabela de itens do template ────────────────────────────────────────
    op.create_table(
        "producer_schedule_template_items",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=False), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column(
            "template_id",
            UUID(as_uuid=False),
            sa.ForeignKey("producer_schedule_templates.id"),
            nullable=False,
        ),
        sa.Column("day_number", sa.Integer, nullable=False),
        sa.Column("order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("item_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("lesson_id", UUID(as_uuid=False), sa.ForeignKey("lessons.id"), nullable=True),
        sa.Column("subject_id", UUID(as_uuid=False), sa.ForeignKey("subjects.id"), nullable=True),
        sa.Column("estimated_minutes", sa.Integer, nullable=False, server_default="30"),
        sa.Column("question_filters", JSON, nullable=True),
        # BaseModel fields
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_prod_sched_item_template", "producer_schedule_template_items", ["template_id"])
    op.create_index("ix_prod_sched_item_day", "producer_schedule_template_items", ["template_id", "day_number"])

    # ── 3. Adiciona colunas em study_schedules ────────────────────────────────
    op.add_column(
        "study_schedules",
        sa.Column("source_type", sa.String(30), nullable=False, server_default="ai"),
        # Valores: "ai" | "producer_template"
    )
    op.add_column(
        "study_schedules",
        sa.Column(
            "template_id",
            UUID(as_uuid=False),
            sa.ForeignKey("producer_schedule_templates.id"),
            nullable=True,
        ),
    )

    # ── 4. Adiciona colunas em schedule_items ─────────────────────────────────
    op.add_column(
        "schedule_items",
        sa.Column("question_filters", JSON, nullable=True),
    )
    op.add_column(
        "schedule_items",
        sa.Column("template_item_title", sa.String(255), nullable=True),
    )
    op.add_column(
        "schedule_items",
        sa.Column("template_item_notes", sa.Text, nullable=True),
    )


def downgrade():
    op.drop_column("schedule_items", "template_item_notes")
    op.drop_column("schedule_items", "template_item_title")
    op.drop_column("schedule_items", "question_filters")
    op.drop_column("study_schedules", "template_id")
    op.drop_column("study_schedules", "source_type")
    op.drop_index("ix_prod_sched_item_day", table_name="producer_schedule_template_items")
    op.drop_index("ix_prod_sched_item_template", table_name="producer_schedule_template_items")
    op.drop_table("producer_schedule_template_items")
    op.drop_index("ix_prod_sched_tmpl_tenant", table_name="producer_schedule_templates")
    op.drop_index("ix_prod_sched_tmpl_course", table_name="producer_schedule_templates")
    op.drop_table("producer_schedule_templates")