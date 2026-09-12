from datetime import datetime

from pydantic import BaseModel, Field

from .models import MemoryType


class MemoryCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=240)
    statement: str = Field(min_length=1)
    type: MemoryType
    project_id: str | None = None
    confidence: float = Field(default=0.5, ge=0, le=1)
    source: str | None = Field(default=None, max_length=500)
    verification_status: str = Field(default="unverified", max_length=32)
    importance: int = Field(default=50, ge=0, le=100)
    valid_until: datetime | None = None


class MemorySupersede(BaseModel):
    statement: str = Field(min_length=1)
    confidence: float = Field(default=1.0, ge=0, le=1)
    source: str | None = Field(default=None, max_length=500)


class MemoryConfirm(BaseModel):
    evidence_id: str = Field(min_length=1, max_length=64)


class MemoryView(BaseModel):
    id: str
    project_id: str | None
    type: MemoryType
    subject: str
    statement: str
    confidence: float
    source: str | None
    verification_status: str
    importance: int
    valid_until: datetime | None

    model_config = {"from_attributes": True}
