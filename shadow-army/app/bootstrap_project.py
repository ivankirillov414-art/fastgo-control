from sqlalchemy import select

from .commander import CommanderService
from .db import SessionLocal
from .keeper import KeeperService
from .manager import ManagerService
from .models import MemoryType, Project, VerificationMode

PROJECT_NAME = "Теневая армия"


def bootstrap() -> dict:
    with SessionLocal() as db:
        manager = ManagerService(db)
        keeper = KeeperService(db)
        project = db.scalar(select(Project).where(Project.name == PROJECT_NAME))
        if project is None:
            project = manager.create_project(
                PROJECT_NAME,
                "Создать ядро интеллектуальных помощников, способных совместно помнить контекст, управлять проектами и координировать работу.",
                "Командир E, Хранитель E и Управляющий E проходят один сквозной проектный цикл с сохранением памяти и следующим действием.",
                {"main_site_untouched": True, "dangerous_actions_require_approval": True},
                100,
            )
            keeper.remember(project_id=project.id, memory_type=MemoryType.DECISION, subject=PROJECT_NAME, statement="Первая рабочая тройка: Командир E, Хранитель E, Управляющий E.", confidence=1.0, source="user-approved architecture", verification_status="verified", importance=100)
            keeper.remember(project_id=project.id, memory_type=MemoryType.DECISION, subject=PROJECT_NAME, statement="Ранг и уровень автономии являются независимыми параметрами.", confidence=1.0, source="architecture v0.1", verification_status="verified", importance=90)
            keeper.remember(project_id=project.id, memory_type=MemoryType.FACT, subject=PROJECT_NAME, statement="Разработка ведётся изолированно от основного сайта в ветке shadow-army-v0.1.", confidence=1.0, source="repository state", verification_status="verified", importance=100)
            keeper.remember(project_id=project.id, memory_type=MemoryType.LESSON, subject=PROJECT_NAME, statement="Изменения рабочего сайта и основной ветки нельзя выполнять без явного разрешения пользователя.", confidence=1.0, source="user instruction", verification_status="verified", importance=100)

            stage = manager.add_stage(project.id, "Ядро v0.1", "Связать три E-ранговые тени в проверяемый рабочий цикл", 0)
            quest = manager.add_quest(stage.id, "Сквозной цикл трёх теней", "Командир получает запрос, Хранитель возвращает контекст, Управляющий выдаёт следующее действие.", "Контекст содержит сохранённые решения; существует хотя бы одно доступное следующее действие.", VerificationMode.AUTO, 100)
            manager.add_task(quest.id, "Прогнать PROJECT-001 через Командира", "Передать реальную цель Командиру и проверить делегирование Хранителю и Управляющему.", 15, "commander")
            manager.add_task(quest.id, "Проверить восстановление памяти", "Повторный запрос должен получить ранее сохранённые факты и решения из PostgreSQL.", 10, "keeper")

        commander = CommanderService(db)
        response = commander.handle("Продолжить разработку проекта Теневая армия и определить следующий шаг", project.id)
        return {"project_id": project.id, "commander_response": response}


if __name__ == "__main__":
    import json
    print(json.dumps(bootstrap(), ensure_ascii=False, indent=2, default=str))
