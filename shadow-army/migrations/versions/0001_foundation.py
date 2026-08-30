"""Shadow Army M0 foundation schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001_foundation"
down_revision = None
branch_labels = None
depends_on = None

agent_rank = sa.Enum("E", "D", "C", "B", "A", "S", name="agentrank")
project_status = sa.Enum("IDEA", "ACTIVE", "BLOCKED", "COMPLETED", "CANCELLED", name="projectstatus")
memory_type = sa.Enum("FACT", "HYPOTHESIS", "DECISION", "RESULT", "LESSON", "RESOURCE", name="memorytype")
approval_status = sa.Enum("WAITING", "APPROVED", "REJECTED", "CONSUMED", name="approvalstatus")


def upgrade() -> None:
    agent_rank.create(op.get_bind(), checkfirst=True)
    project_status.create(op.get_bind(), checkfirst=True)
    memory_type.create(op.get_bind(), checkfirst=True)
    approval_status.create(op.get_bind(), checkfirst=True)

    op.create_table("agents", sa.Column("id", sa.String(64), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("role", sa.Text(), nullable=False), sa.Column("rank", agent_rank, nullable=False), sa.Column("autonomy_level", sa.Integer(), nullable=False), sa.Column("status", sa.String(32), nullable=False), sa.Column("allowed_tools", sa.JSON(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("projects", sa.Column("id", sa.String(64), primary_key=True), sa.Column("name", sa.String(240), nullable=False), sa.Column("goal", sa.Text(), nullable=False), sa.Column("success_criteria", sa.Text(), nullable=False), sa.Column("constraints", sa.JSON(), nullable=False), sa.Column("status", project_status, nullable=False), sa.Column("priority", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("memories", sa.Column("id", sa.String(64), primary_key=True), sa.Column("project_id", sa.String(64), sa.ForeignKey("projects.id"), nullable=True), sa.Column("type", memory_type, nullable=False), sa.Column("subject", sa.String(240), nullable=False), sa.Column("statement", sa.Text(), nullable=False), sa.Column("confidence", sa.Float(), nullable=False), sa.Column("source", sa.String(500), nullable=True), sa.Column("verification_status", sa.String(32), nullable=False), sa.Column("importance", sa.Integer(), nullable=False), sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_memories_subject", "memories", ["subject"])
    op.create_table("relations", sa.Column("id", sa.String(64), primary_key=True), sa.Column("from_id", sa.String(64), nullable=False), sa.Column("relation", sa.String(80), nullable=False), sa.Column("to_id", sa.String(64), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_relations_from_id", "relations", ["from_id"])
    op.create_index("ix_relations_relation", "relations", ["relation"])
    op.create_index("ix_relations_to_id", "relations", ["to_id"])
    op.create_table("events", sa.Column("id", sa.String(64), primary_key=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("actor", sa.String(64), nullable=False), sa.Column("action", sa.String(120), nullable=False), sa.Column("target", sa.String(120), nullable=True), sa.Column("reason", sa.Text(), nullable=True), sa.Column("payload", sa.JSON(), nullable=False))
    op.create_index("ix_events_created_at", "events", ["created_at"])
    op.create_index("ix_events_actor", "events", ["actor"])
    op.create_index("ix_events_action", "events", ["action"])
    op.create_table("approvals", sa.Column("id", sa.String(64), primary_key=True), sa.Column("requested_by", sa.String(64), nullable=False), sa.Column("action", sa.String(120), nullable=False), sa.Column("target", sa.String(500), nullable=True), sa.Column("description", sa.Text(), nullable=False), sa.Column("risk", sa.String(32), nullable=False), sa.Column("reversible", sa.Boolean(), nullable=False), sa.Column("status", approval_status, nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade() -> None:
    op.drop_table("approvals")
    op.drop_table("events")
    op.drop_table("relations")
    op.drop_table("memories")
    op.drop_table("projects")
    op.drop_table("agents")
    approval_status.drop(op.get_bind(), checkfirst=True)
    memory_type.drop(op.get_bind(), checkfirst=True)
    project_status.drop(op.get_bind(), checkfirst=True)
    agent_rank.drop(op.get_bind(), checkfirst=True)
