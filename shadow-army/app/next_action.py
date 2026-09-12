from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Project, ProjectStatus, Quest, Stage, Task, WorkStatus
from .quest_priority import QuestSignals, quest_score


class NextActionService:
    """Select one best user action across every active project."""

    def __init__(self, db: Session):
        self.db = db

    def choose(self, now: datetime | None = None) -> dict | None:
        rows = self.db.execute(
            select(Task, Quest, Stage, Project)
            .join(Quest, Task.quest_id == Quest.id)
            .join(Stage, Quest.stage_id == Stage.id)
            .join(Project, Stage.project_id == Project.id)
            .where(
                Project.status == ProjectStatus.ACTIVE,
                Quest.status.in_([WorkStatus.AVAILABLE, WorkStatus.IN_PROGRESS]),
                Task.status.in_([WorkStatus.AVAILABLE, WorkStatus.IN_PROGRESS]),
            )
        ).all()

        candidates = []
        for task, quest, stage, project in rows:
            signals = QuestSignals(
                priority=max(project.priority, quest.priority),
                estimate_minutes=task.estimate_minutes or quest.estimate_minutes,
                deadline=quest.deadline,
                money_now=quest.reward_money,
                xp=quest.reward_xp,
                business_value=quest.business_value,
                skill_value=quest.skill_value,
                unblock_value=quest.unblock_value,
                user_required=not bool(task.executor and task.executor != "user"),
            )
            # Work assigned to a shadow should not occupy the user's attention.
            if not signals.user_required:
                continue
            candidates.append((quest_score(signals, now), task, quest, stage, project))

        if not candidates:
            return None

        score, task, quest, stage, project = max(candidates, key=lambda row: row[0])
        return {
            "task_id": task.id,
            "task": task.title,
            "quest_id": quest.id,
            "quest": quest.title,
            "project_id": project.id,
            "project": project.name,
            "stage": stage.name,
            "score": score,
            "deadline": quest.deadline,
            "estimate_minutes": task.estimate_minutes or quest.estimate_minutes,
            "rewards": {
                "money": quest.reward_money,
                "xp": quest.reward_xp,
                "business": quest.business_value,
                "skill": quest.skill_value,
            },
        }
