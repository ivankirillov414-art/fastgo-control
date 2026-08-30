from fastapi import FastAPI

from .config import get_settings

settings = get_settings()
app = FastAPI(title="Shadow Army Core", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "shadow-army", "version": "0.1.0", "environment": settings.app_env}


@app.get("/army")
def army() -> dict:
    return {
        "status": "foundation",
        "agents": [
            {"id": "commander", "name": "Командир", "rank": "E"},
            {"id": "keeper", "name": "Хранитель", "rank": "E"},
            {"id": "manager", "name": "Управляющий", "rank": "E"},
        ],
    }
