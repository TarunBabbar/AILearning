"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255)),
        sa.Column("picture", sa.String(512)),
        sa.Column("provider", sa.String(50), server_default="credentials"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "workspaces",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "workspace_members",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), primary_key=True),
        sa.Column("role", sa.String(20), server_default="qa"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "connections",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), server_default="connected"),
        sa.Column("secret_ciphertext", sa.Text, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("scope_config", sa.JSON, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_connections_workspace_id", "connections", ["workspace_id"])

    op.create_table(
        "requirements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("source_key", sa.String(255), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("acceptance_criteria", sa.JSON, server_default="[]"),
        sa.Column("source_link", sa.String(512)),
        sa.Column("rubric", sa.JSON),
        sa.Column("risk_tier", sa.String(20), server_default="medium"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_requirements_workspace_id", "requirements", ["workspace_id"])
    op.create_index("ix_requirements_source_key", "requirements", ["source_key"])

    op.create_table(
        "test_cases",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("requirement_id", sa.String(36)),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("test_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("source", sa.String(20), server_default="ai-generated"),
        sa.Column("derived_from", sa.String(512)),
        sa.Column("code", sa.Text),
        sa.Column("tags", sa.JSON, server_default="[]"),
        sa.Column("priority", sa.String(10), server_default="P2"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_test_cases_workspace_id", "test_cases", ["workspace_id"])

    op.create_table(
        "coverage_map",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("requirement_id", sa.String(36), nullable=False),
        sa.Column("test_case_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_coverage_map_workspace_id", "coverage_map", ["workspace_id"])

    op.create_table(
        "runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("trigger", sa.String(20), server_default="manual"),
        sa.Column("status", sa.String(20), server_default="queued"),
        sa.Column("gate_verdict", sa.String(20)),
        sa.Column("threshold_snapshot", sa.JSON, server_default="{}"),
        sa.Column("trace_id", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_runs_workspace_id", "runs", ["workspace_id"])

    op.create_table(
        "run_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(36), nullable=False),
        sa.Column("test_case_id", sa.String(36)),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_run_results_run_id", "run_results", ["run_id"])
    op.create_index("ix_run_results_workspace_id", "run_results", ["workspace_id"])

    op.create_table(
        "metric_scores",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_result_id", sa.String(36), nullable=False),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("metric", sa.String(60), nullable=False),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("threshold", sa.Float, nullable=False),
        sa.Column("hard_gate", sa.Boolean, server_default="false"),
        sa.Column("passed", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_metric_scores_run_result_id", "metric_scores", ["run_result_id"])
    op.create_index("ix_metric_scores_workspace_id", "metric_scores", ["workspace_id"])

    op.create_table(
        "traces",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("run_id", sa.String(36)),
        sa.Column("langfuse_trace_id", sa.String(128), nullable=False),
        sa.Column("artifact_keys", sa.JSON, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_traces_workspace_id", "traces", ["workspace_id"])
    op.create_index("ix_traces_langfuse_trace_id", "traces", ["langfuse_trace_id"])

    op.create_table(
        "review_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("kind", sa.String(20), server_default="generated"),
        sa.Column("test_case_id", sa.String(36)),
        sa.Column("run_result_id", sa.String(36)),
        sa.Column("status", sa.String(20), server_default="open"),
        sa.Column("reason", sa.Text),
        sa.Column("jira_key", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_review_items_workspace_id", "review_items", ["workspace_id"])

    op.create_table(
        "workspace_settings",
        sa.Column("workspace_id", sa.String(36), primary_key=True),
        sa.Column("thresholds", sa.JSON, server_default="{}"),
        sa.Column("risk_tiers", sa.JSON, server_default="{}"),
        sa.Column("gate_policy", sa.JSON, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("workspace_settings")
    op.drop_table("review_items")
    op.drop_table("traces")
    op.drop_table("metric_scores")
    op.drop_table("run_results")
    op.drop_table("runs")
    op.drop_table("coverage_map")
    op.drop_table("test_cases")
    op.drop_table("requirements")
    op.drop_table("connections")
    op.drop_table("workspace_members")
    op.drop_table("workspaces")
    op.drop_table("users")
