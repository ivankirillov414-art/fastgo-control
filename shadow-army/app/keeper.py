from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .models import Event, Memory, MemoryType, Relation


class KeeperService:
    """Keeper E: structured memory, versioning, retrieval and compact Context Packs."""

    def __init__(self, db: Session):
        self.db = db

    def remember(self, *, subject: str, statement: str, memory_type: MemoryType, project_id: str | None = None, confidence: float = 0.5, source: str | None = None, verification_status: str = "unverified", importance: int = 50, valid_until: datetime | None = None) -> Memory:
        memory = Memory(project_id=project_id, type=memory_type, subject=subject.strip(), statement=statement.strip(), confidence=max(0.0, min(1.0, confidence)), source=source, verification_status=verification_status, importance=max(0, min(100, importance)), valid_until=valid_until)
        self.db.add(memory)
        self.db.flush()
        self._event("MEMORY_CREATED", memory.id, {"type": memory.type.value, "subject": memory.subject})
        self.db.commit()
        self.db.refresh(memory)
        return memory

    def supersede(self, old_memory_id: str, *, statement: str, confidence: float = 1.0, source: str | None = None) -> Memory:
        old = self.db.get(Memory, old_memory_id)
        if old is None:
            raise ValueError("Memory not found")
        new = Memory(project_id=old.project_id, type=old.type, subject=old.subject, statement=statement.strip(), confidence=max(0.0, min(1.0, confidence)), source=source, verification_status="verified", importance=old.importance, valid_until=old.valid_until)
        self.db.add(new)
        self.db.flush()
        self.db.add(Relation(from_id=new.id, relation="supersedes", to_id=old.id))
        self._event("MEMORY_SUPERSEDED", new.id, {"old_memory_id": old.id})
        self.db.commit()
        self.db.refresh(new)
        return new

    def confirm_by(self, memory_id: str, evidence_id: str) -> None:
        memory = self.db.get(Memory, memory_id)
        if memory is None:
            raise ValueError("Memory not found")
        self.db.add(Relation(from_id=memory_id, relation="confirmed_by", to_id=evidence_id))
        memory.verification_status = "verified"
        self._event("MEMORY_CONFIRMED", memory_id, {"evidence_id": evidence_id})
        self.db.commit()

    def search(self, query: str, project_id: str | None = None, limit: int = 20) -> list[Memory]:
        needle = f"%{query.strip()}%"
        superseded_ids = select(Relation.to_id).where(Relation.relation == "supersedes")
        stmt = select(Memory).where(or_(Memory.subject.ilike(needle), Memory.statement.ilike(needle)), Memory.id.not_in(superseded_ids))
        if project_id:
            stmt = stmt.where(Memory.project_id == project_id)
        stmt = stmt.order_by(Memory.importance.desc(), Memory.confidence.desc(), Memory.created_at.desc()).limit(min(max(limit, 1), 100))
        return list(self.db.scalars(stmt))

    def history(self, memory_id: str) -> list[dict]:
        current = self.db.get(Memory, memory_id)
        if current is None:
            return []
        result = [self._view(current)]
        seen = {current.id}
        cursor = current.id
        while True:
            relation = self.db.scalar(select(Relation).where(Relation.from_id == cursor, Relation.relation == "supersedes"))
            if relation is None or relation.to_id in seen:
                break
            previous = self.db.get(Memory, relation.to_id)
            if previous is None:
                break
            result.append(self._view(previous))
            seen.add(previous.id)
            cursor = previous.id
        return result

    def context_pack(self, subject: str, project_id: str | None = None, limit: int = 20) -> dict:
        memories = self.search(subject, project_id=project_id, limit=limit)
        now = datetime.now(timezone.utc)
        stale = [m for m in memories if m.valid_until and m.valid_until < now]
        active = [m for m in memories if m not in stale]
        conflicts = []
        facts = [m for m in active if m.type == MemoryType.FACT]
        groups: dict[str, list[Memory]] = {}
        for fact in facts:
            groups.setdefault(fact.subject.strip().casefold(), []).append(fact)
        for key, group in groups.items():
            if len({m.statement.strip().casefold() for m in group}) > 1:
                conflicts.append({"subject": key, "memory_ids": [m.id for m in group], "statements": [m.statement for m in group]})
        by_type = {kind.value: [] for kind in MemoryType}
        for memory in active:
            by_type[memory.type.value].append(self._view(memory))
        return {"subject": subject, "project_id": project_id, "facts": by_type["fact"], "decisions": by_type["decision"], "lessons": by_type["lesson"], "results": by_type["result"], "resources": by_type["resource"], "hypotheses": by_type["hypothesis"], "stale": [self._view(m) for m in stale], "conflicts": conflicts, "unknowns": [] if active else [f"No memory found for: {subject}"]}

    def _event(self, action: str, target: str, payload: dict) -> None:
        self.db.add(Event(actor="keeper", action=action, target=target, reason="Keeper E memory operation", payload=payload))

    @staticmethod
    def _view(memory: Memory) -> dict:
        return {"id": memory.id, "type": memory.type.value, "subject": memory.subject, "statement": memory.statement, "confidence": memory.confidence, "source": memory.source, "verification_status": memory.verification_status, "importance": memory.importance, "valid_until": memory.valid_until.isoformat() if memory.valid_until else None}
