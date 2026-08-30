import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def uid() -> str:
    return str(uuid.uuid4())


class AgentRank(str, enum.Enum):
    E="E"; D="D"; C="C"; B="B"; A="A"; S="S"

class ProjectStatus(str, enum.Enum):
    IDEA="idea"; ACTIVE="active"; BLOCKED="blocked"; COMPLETED="completed"; CANCELLED="cancelled"

class WorkStatus(str, enum.Enum):
    PLANNED="planned"; AVAILABLE="available"; IN_PROGRESS="in_progress"; REVIEW="review"; DONE="done"; BLOCKED="blocked"; CANCELLED="cancelled"

class VerificationMode(str, enum.Enum):
    AUTO="auto"; AI="ai"; USER="user"; HYBRID="hybrid"

class MemoryType(str, enum.Enum):
    FACT="fact"; HYPOTHESIS="hypothesis"; DECISION="decision"; RESULT="result"; LESSON="lesson"; RESOURCE="resource"

class ApprovalStatus(str, enum.Enum):
    WAITING="waiting"; APPROVED="approved"; REJECTED="rejected"; CONSUMED="consumed"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Agent(Base, TimestampMixin):
    __tablename__="agents"
    id: Mapped[str]=mapped_column(String(64), primary_key=True); name: Mapped[str]=mapped_column(String(120)); role: Mapped[str]=mapped_column(Text); rank: Mapped[AgentRank]=mapped_column(Enum(AgentRank), default=AgentRank.E); autonomy_level: Mapped[int]=mapped_column(default=1); status: Mapped[str]=mapped_column(String(32), default="active"); allowed_tools: Mapped[list]=mapped_column(JSON, default=list)

class Project(Base, TimestampMixin):
    __tablename__="projects"
    id: Mapped[str]=mapped_column(String(64), primary_key=True, default=uid); name: Mapped[str]=mapped_column(String(240)); goal: Mapped[str]=mapped_column(Text); success_criteria: Mapped[str]=mapped_column(Text); constraints: Mapped[dict]=mapped_column(JSON, default=dict); status: Mapped[ProjectStatus]=mapped_column(Enum(ProjectStatus), default=ProjectStatus.IDEA); priority: Mapped[int]=mapped_column(default=50)

class Stage(Base, TimestampMixin):
    __tablename__="stages"
    id: Mapped[str]=mapped_column(String(64), primary_key=True, default=uid); project_id: Mapped[str]=mapped_column(ForeignKey("projects.id"), index=True); name: Mapped[str]=mapped_column(String(240)); goal: Mapped[str]=mapped_column(Text); position: Mapped[int]=mapped_column(default=0); status: Mapped[WorkStatus]=mapped_column(Enum(WorkStatus), default=WorkStatus.PLANNED)

class Quest(Base, TimestampMixin):
    __tablename__="quests"
    id: Mapped[str]=mapped_column(String(64), primary_key=True, default=uid); stage_id: Mapped[str]=mapped_column(ForeignKey("stages.id"), index=True); title: Mapped[str]=mapped_column(String(240)); result: Mapped[str]=mapped_column(Text); success_criteria: Mapped[str]=mapped_column(Text); verification_mode: Mapped[VerificationMode]=mapped_column(Enum(VerificationMode), default=VerificationMode.USER); status: Mapped[WorkStatus]=mapped_column(Enum(WorkStatus), default=WorkStatus.PLANNED); priority: Mapped[int]=mapped_column(default=50)

class Task(Base, TimestampMixin):
    __tablename__="tasks"
    id: Mapped[str]=mapped_column(String(64), primary_key=True, default=uid); quest_id: Mapped[str]=mapped_column(ForeignKey("quests.id"), index=True); title: Mapped[str]=mapped_column(String(240)); description: Mapped[str]=mapped_column(Text, default=""); status: Mapped[WorkStatus]=mapped_column(Enum(WorkStatus), default=WorkStatus.PLANNED); estimate_minutes: Mapped[int | None]=mapped_column(nullable=True); executor: Mapped[str | None]=mapped_column(String(64), nullable=True); blocker: Mapped[str | None]=mapped_column(Text, nullable=True); depends_on: Mapped[list]=mapped_column(JSON, default=list)

class Memory(Base, TimestampMixin):
    __tablename__="memories"
    id: Mapped[str]=mapped_column(String(64), primary_key=True, default=uid); project_id: Mapped[str | None]=mapped_column(ForeignKey("projects.id"), nullable=True); type: Mapped[MemoryType]=mapped_column(Enum(MemoryType)); subject: Mapped[str]=mapped_column(String(240), index=True); statement: Mapped[str]=mapped_column(Text); confidence: Mapped[float]=mapped_column(Float, default=0.5); source: Mapped[str | None]=mapped_column(String(500), nullable=True); verification_status: Mapped[str]=mapped_column(String(32), default="unverified"); importance: Mapped[int]=mapped_column(default=50); valid_until: Mapped[datetime | None]=mapped_column(DateTime(timezone=True), nullable=True)

class Relation(Base, TimestampMixin):
    __tablename__="relations"
    id: Mapped[str]=mapped_column(String(64), primary_key=True, default=uid); from_id: Mapped[str]=mapped_column(String(64), index=True); relation: Mapped[str]=mapped_column(String(80), index=True); to_id: Mapped[str]=mapped_column(String(64), index=True)

class Event(Base):
    __tablename__="events"
    id: Mapped[str]=mapped_column(String(64), primary_key=True, default=uid); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), server_default=func.now(), index=True); actor: Mapped[str]=mapped_column(String(64), index=True); action: Mapped[str]=mapped_column(String(120), index=True); target: Mapped[str | None]=mapped_column(String(120), nullable=True); reason: Mapped[str | None]=mapped_column(Text, nullable=True); payload: Mapped[dict]=mapped_column(JSON, default=dict)

class Approval(Base, TimestampMixin):
    __tablename__="approvals"
    id: Mapped[str]=mapped_column(String(64), primary_key=True, default=uid); requested_by: Mapped[str]=mapped_column(String(64)); action: Mapped[str]=mapped_column(String(120)); target: Mapped[str | None]=mapped_column(String(500), nullable=True); description: Mapped[str]=mapped_column(Text); risk: Mapped[str]=mapped_column(String(32), default="medium"); reversible: Mapped[bool]=mapped_column(default=False); status: Mapped[ApprovalStatus]=mapped_column(Enum(ApprovalStatus), default=ApprovalStatus.WAITING)
