"""Workspace-scoped domain models. Every table carries workspace_id.

Security invariant: NO query may cross workspace boundaries. All data access
goes through repository functions that always filter by workspace_id.
"""
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, IdMixin, TimestampMixin, new_id


class User(Base, IdMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))
    picture: Mapped[str | None] = mapped_column(String(512))
    provider: Mapped[str] = mapped_column(String(50), default="credentials")


class Workspace(Base, IdMixin, TimestampMixin):
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    members: Mapped[list["WorkspaceMember"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )


class WorkspaceMember(Base, TimestampMixin):
    __tablename__ = "workspace_members"
    __table_args__ = (  # composite PK
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(20), default="qa")  # owner|admin|qa

    workspace: Mapped[Workspace] = relationship(back_populates="members")


class Connection(Base, IdMixin, TimestampMixin):
    __tablename__ = "connections"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # github|jira|database
    status: Mapped[str] = mapped_column(String(20), default="connected")  # connected|expired
    secret_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)  # KMS envelope-encrypted
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scope_config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class Requirement(Base, IdMixin, TimestampMixin):
    __tablename__ = "requirements"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_key: Mapped[str] = mapped_column(String(255), index=True)  # Jira ticket key
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    acceptance_criteria: Mapped[list[Any]] = mapped_column(JSON, default=list)
    source_link: Mapped[str | None] = mapped_column(String(512))
    rubric: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    risk_tier: Mapped[str] = mapped_column(String(20), default="medium")  # high|medium|low

    test_cases: Mapped[list["TestCase"]] = relationship(back_populates="requirement")


class TestCase(Base, IdMixin, TimestampMixin):
    __tablename__ = "test_cases"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    requirement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("requirements.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    test_type: Mapped[str] = mapped_column(String(20), nullable=False)  # ui|api|db|integration
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|approved|rejected|archived
    source: Mapped[str] = mapped_column(String(20), default="ai-generated")  # ai-generated|user-provided
    derived_from: Mapped[str | None] = mapped_column(String(512))  # traceability: jira key / diff / existing test
    code: Mapped[str | None] = mapped_column(Text)  # compiled test payload
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    priority: Mapped[str] = mapped_column(String(10), default="P2")

    requirement: Mapped[Requirement | None] = relationship(back_populates="test_cases")


class CoverageMap(Base, TimestampMixin):
    """Requirement ↔ test-case link for traceability + gap detection."""

    __tablename__ = "coverage_map"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    requirement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False
    )
    test_case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False
    )


class Run(Base, IdMixin, TimestampMixin):
    __tablename__ = "runs"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    trigger: Mapped[str] = mapped_column(String(20), default="manual")  # manual|pr|nightly|release
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued|running|passed|failed|blocked
    gate_verdict: Mapped[str | None] = mapped_column(String(20))  # pass|block
    threshold_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    trace_id: Mapped[str | None] = mapped_column(String(128), index=True)


class RunResult(Base, IdMixin, TimestampMixin):
    __tablename__ = "run_results"

    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    test_case_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("test_cases.id", ondelete="SET NULL")
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|passed|failed|error|skipped
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)


class MetricScore(Base, IdMixin, TimestampMixin):
    __tablename__ = "metric_scores"

    run_result_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("run_results.id", ondelete="CASCADE"), index=True, nullable=False
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    metric: Mapped[str] = mapped_column(String(60), nullable=False)
    score: Mapped[float] = mapped_column(nullable=False)
    threshold: Mapped[float] = mapped_column(nullable=False)
    hard_gate: Mapped[bool] = mapped_column(Boolean, default=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)


class Trace(Base, IdMixin, TimestampMixin):
    __tablename__ = "traces"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("runs.id", ondelete="SET NULL")
    )
    langfuse_trace_id: Mapped[str] = mapped_column(String(128), index=True)
    artifact_keys: Mapped[list[str]] = mapped_column(JSON, default=list)  # S3 keys


class ReviewItem(Base, IdMixin, TimestampMixin):
    __tablename__ = "review_items"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), default="generated")  # generated|defect
    test_case_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("test_cases.id", ondelete="SET NULL")
    )
    run_result_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("run_results.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(20), default="open")  # open|approved|rejected|jira_created
    reason: Mapped[str | None] = mapped_column(Text)
    jira_key: Mapped[str | None] = mapped_column(String(50))


class WorkspaceSettings(Base, TimestampMixin):
    __tablename__ = "workspace_settings"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    thresholds: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    risk_tiers: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    gate_policy: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
