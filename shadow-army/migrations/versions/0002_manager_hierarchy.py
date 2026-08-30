"""Manager E project hierarchy."""
from alembic import op
import sqlalchemy as sa

revision="0002_manager_hierarchy"
down_revision="0001_foundation"
branch_labels=None
depends_on=None

work_status=sa.Enum("PLANNED","AVAILABLE","IN_PROGRESS","REVIEW","DONE","BLOCKED","CANCELLED", name="workstatus")
verification_mode=sa.Enum("AUTO","AI","USER","HYBRID", name="verificationmode")

def upgrade():
    work_status.create(op.get_bind(), checkfirst=True); verification_mode.create(op.get_bind(), checkfirst=True)
    op.create_table("stages", sa.Column("id",sa.String(64),primary_key=True),sa.Column("project_id",sa.String(64),sa.ForeignKey("projects.id"),nullable=False),sa.Column("name",sa.String(240),nullable=False),sa.Column("goal",sa.Text(),nullable=False),sa.Column("position",sa.Integer(),nullable=False),sa.Column("status",work_status,nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False)); op.create_index("ix_stages_project_id","stages",["project_id"])
    op.create_table("quests",sa.Column("id",sa.String(64),primary_key=True),sa.Column("stage_id",sa.String(64),sa.ForeignKey("stages.id"),nullable=False),sa.Column("title",sa.String(240),nullable=False),sa.Column("result",sa.Text(),nullable=False),sa.Column("success_criteria",sa.Text(),nullable=False),sa.Column("verification_mode",verification_mode,nullable=False),sa.Column("status",work_status,nullable=False),sa.Column("priority",sa.Integer(),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False)); op.create_index("ix_quests_stage_id","quests",["stage_id"])
    op.create_table("tasks",sa.Column("id",sa.String(64),primary_key=True),sa.Column("quest_id",sa.String(64),sa.ForeignKey("quests.id"),nullable=False),sa.Column("title",sa.String(240),nullable=False),sa.Column("description",sa.Text(),nullable=False),sa.Column("status",work_status,nullable=False),sa.Column("estimate_minutes",sa.Integer(),nullable=True),sa.Column("executor",sa.String(64),nullable=True),sa.Column("blocker",sa.Text(),nullable=True),sa.Column("depends_on",sa.JSON(),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False)); op.create_index("ix_tasks_quest_id","tasks",["quest_id"])

def downgrade():
    op.drop_table("tasks"); op.drop_table("quests"); op.drop_table("stages"); verification_mode.drop(op.get_bind(),checkfirst=True); work_status.drop(op.get_bind(),checkfirst=True)
