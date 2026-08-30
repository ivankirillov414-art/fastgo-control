from fastapi import Depends, FastAPI, Query
from sqlalchemy.orm import Session

from .config import get_settings
from .db import SessionLocal
from .keeper import KeeperService
from .schemas import MemoryCreate, MemoryView

settings = get_settings()
app = FastAPI(title="Shadow Army Core", version="0.1.0")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "shadow-army", "version": "0.1.0", "environment": settings.app_env}


@app.get("/army")
def army() -> dict:
    return {
        "status": "m1-keeper",
        "agents": [
            {"id": "commander", "name": "Командир", "rank": "E"},
            {"id": "keeper", "name": "Хранитель", "rank": "E"},
            {"id": "manager", "name": "Управляющий", "rank": "E"},
        ],
    }


@app.post("/memory", response_model=MemoryView, status_code=201)
def create_memory(payload: MemoryCreate, db: Session = Depends(get_db)):
    return KeeperService(db).remember(
        subject=payload.subject,
        statement=payload.statement,
        memory_type=payload.type,
        project_id=payload.project_id,
        confidence=payload.confidence,
        source=payload.source,
        verification_status=payload.verification_status,
        importance=payload.importance,
        valid_until=payload.valid_until,
    )


@app.get("/memory/search", response_model=list[MemoryView])
def search_memory(q: str = Query(min_length=1), project_id: str | None = None, limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)):
    return KeeperService(db).search(q, project_id=project_id, limit=limit)


@app.get("/memory/context")
def memory_context(subject: str = Query(min_length=1), project_id: str | None = None, limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)):
    return KeeperService(db).context_pack(subject, project_id=project_id, limit=limit)
