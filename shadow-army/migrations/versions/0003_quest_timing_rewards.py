"""Quest timing and independent reward dimensions."""
from alembic import op
import sqlalchemy as sa

revision = "0003_quest_timing_rewards"
down_revision = "0002_manager_hierarchy"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("quests", sa.Column("deadline", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quests", sa.Column("estimate_minutes", sa.Integer(), nullable=True))
    op.add_column("quests", sa.Column("reward_money", sa.Float(), nullable=False, server_default="0"))
    op.add_column("quests", sa.Column("reward_xp", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("quests", sa.Column("business_value", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("quests", sa.Column("skill_value", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("quests", sa.Column("unblock_value", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("quests", sa.Column("expiry_policy", sa.String(32), nullable=False, server_default="replan"))


def downgrade():
    for name in ["expiry_policy", "unblock_value", "skill_value", "business_value", "reward_xp", "reward_money", "estimate_minutes", "deadline"]:
        op.drop_column("quests", name)
