from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .models import Event, Memory, MemoryType


class KeeperService:
    """Keeper E: structured memory, retrieval and compact Context Packs."""

    def __init__(self, db: Session):
        self.db = db

    def remember(
        self,
        *,
        subject: str,
        statement: str,
        memory_type: MemoryType,
        project_id: str | None = None,
        confidence: float = 0.5,
        source: str | None = None,
        verification_status: str = "unverified",
        importance: int = 50,
        valid_until: datetime | None = None,
    ) -> Memory:
        memory = Memory(
            project_id=project_id,
            type=memory_type,
            subject=subject.strip(),
            statement=statement.strip(),
            confidence=max(0.0, min(1.0, confidence)),
            source=source,
            verification_status=verification_status,
            importance=max(0, min(100, importance)),
            valid_until=valid_until,
        )
        self.db.add(memory)
        self.db.flush()
        self.db.add(Event(actor="keeper", action="MEMORY_CREATED", target=memory.id, reason="Keeper E accepted structured memory", payload={"type": memory.type.value, "subject": memory.subject}))
        self.db.commit()
        self.db.refresh(memory)
        return memory

    def search(self, query: str, project_id: str | None = None, limit: int = 20) -> list[Memory]:
        needle = f"%{query.strip()}%"
        stmt = select(Memory).where(or_(Memory.subject.ilike(needle), Memory.statement.ilike(needle)))
        if project_id:
            stmt = stmt.where(Memory.project_id == project_id)
        stmt = stmt.order_by(Memory.importance.desc(), Memory.confidence.desc(), Memory.created_at.desc()).limit(min(max(limit, 1), 100))
        return list(self.db.scalars(stmt))

    def context_pack(self, subject: str, project_id: str | None = None, limit: int = 20) -> dict:
        memories = self.search(subject, project_id=project_id, limit=limit)
        now = datetime.now(timezone.utc)
        stale = [m for m in memories if m.valid_until and m.valid_until < now]
        active = [m for m in memories if m not in stale]

        conflicts: list[dict] = []
        facts = [m for m in active if m.type == MemoryType.FACT]
        normalized: dict[str, list[Memory]] = {}
        for fact in facts:
            normalized.setdefault(fact.subject.strip().casefold(), []).append(fact)
        for key, group in normalized.items():
            statements = {m.statement.strip().casefold() for m in group}
            if len(statements) > 1:
                conflicts.append({"subject": key, "memory_ids": [m.id for m in group], "statements": [m.statement for m in group]})

        by_type = {kind.value: [] for kind in MemoryType}
        for memory in active:
            by_type[memory.type.value].append(self._view(memory))

        return {
            "subject": subject,
            "project_id": project_id,
            "facts": by_type[MemoryType.FACT.value],
            "decisions": by_type[MemoryType.DECISION.value],
            "lessons": by_type[MemoryType.LESSON.value],
            "results": by_type[MemoryType.RESULT.value],
            "resources": by_type[MemoryType.RESOURCE.value],
            "hypotheses": by_type[MemoryType.HYPOTHESIS.value],
            "stale": [self._view(m) for m in stale],
            "conflicts": conflicts,
            "unknowns": [] if active else [f"No memory found for: {subject}"],
        }

    @staticmethod
    def _view(memory: Memory) -> dict:
        return {
            "id": memory.id,
            "type": memory.type.value,
            "subject": memory.subject,
            "statement": memory.statement,
            "confidence": memory.confidence,
            "source": memory.source,
            "verification_status": memory.verification_status,
            "importance": memory.importance,
            "valid_until": memory.valid_until.isoformat() if memory.valid_until else None,
        }
