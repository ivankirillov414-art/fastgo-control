from sqlalchemy import select

from .db import SessionLocal
from .models import Agent, AgentRank, Event

AGENTS = [
    Agent(id="commander", name="Командир", role="Оркестратор: классифицирует запросы, вызывает тени и собирает единый результат.", rank=AgentRank.E, autonomy_level=1, allowed_tools=["memory.search", "project.read", "agent.call", "approval.request"]),
    Agent(id="keeper", name="Хранитель", role="Структурированная долговременная память: факты, решения, результаты, уроки и Context Pack.", rank=AgentRank.E, autonomy_level=1, allowed_tools=["memory.read", "memory.search", "memory.write_candidate", "relation.read", "relation.write"]),
    Agent(id="manager", name="Управляющий", role="Управляет проектами: цель → этап → квест → задача, зависимости и блокеры.", rank=AgentRank.E, autonomy_level=1, allowed_tools=["project.read", "project.create_draft", "quest.create_draft", "task.create_draft"]),
]


def seed() -> None:
    with SessionLocal() as db:
        created = []
        for agent in AGENTS:
            if db.scalar(select(Agent).where(Agent.id == agent.id)) is None:
                db.add(agent)
                created.append(agent.id)
        if created:
            db.add(Event(actor="system", action="FOUNDATION_SEEDED", target="agents", reason="M0 initial Shadow Army roster", payload={"agents": created}))
        db.commit()


if __name__ == "__main__":
    seed()
