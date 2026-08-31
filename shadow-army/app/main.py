from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .commander import CommanderService
from .config import get_settings
from .db import SessionLocal
from .keeper import KeeperService
from .schemas import MemoryConfirm, MemoryCreate, MemorySupersede, MemoryView

settings = get_settings()
app = FastAPI(title="Shadow Army Core", version="0.1.0")


class CommanderRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    project_id: str | None = None
    use_ai: bool = True


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
    return {"status": "m3-commander", "ai_configured": bool(settings.ai_api_key), "agents": [{"id": "commander", "name": "Командир", "rank": "E"}, {"id": "keeper", "name": "Хранитель", "rank": "E"}, {"id": "manager", "name": "Управляющий", "rank": "E"}]}


@app.post("/commander/request")
def commander_request(payload: CommanderRequest, db: Session = Depends(get_db)):
    try:
        return CommanderService(db).handle(payload.text, project_id=payload.project_id, use_ai=payload.use_ai)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/memory", response_model=MemoryView, status_code=201)
def create_memory(payload: MemoryCreate, db: Session = Depends(get_db)):
    return KeeperService(db).remember(subject=payload.subject, statement=payload.statement, memory_type=payload.type, project_id=payload.project_id, confidence=payload.confidence, source=payload.source, verification_status=payload.verification_status, importance=payload.importance, valid_until=payload.valid_until)


@app.get("/memory/search", response_model=list[MemoryView])
def search_memory(q: str = Query(min_length=1), project_id: str | None = None, limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)):
    return KeeperService(db).search(q, project_id=project_id, limit=limit)


@app.get("/memory/context")
def memory_context(subject: str = Query(min_length=1), project_id: str | None = None, limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)):
    return KeeperService(db).context_pack(subject, project_id=project_id, limit=limit)


@app.post("/memory/{memory_id}/supersede", response_model=MemoryView)
def supersede_memory(memory_id: str, payload: MemorySupersede, db: Session = Depends(get_db)):
    try:
        return KeeperService(db).supersede(memory_id, statement=payload.statement, confidence=payload.confidence, source=payload.source)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/memory/{memory_id}/confirm", status_code=204)
def confirm_memory(memory_id: str, payload: MemoryConfirm, db: Session = Depends(get_db)):
    try:
        KeeperService(db).confirm_by(memory_id, payload.evidence_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/memory/{memory_id}/history")
def memory_history(memory_id: str, db: Session = Depends(get_db)):
    history = KeeperService(db).history(memory_id)
    if not history:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"memory_id": memory_id, "versions": history}
