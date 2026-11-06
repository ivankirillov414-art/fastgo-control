from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class QuestSignals:
    priority: int = 50
    estimate_minutes: int | None = None
    deadline: datetime | None = None
    money_now: float = 0
    xp: int = 0
    business_value: int = 0
    skill_value: int = 0
    unblock_value: int = 0
    user_required: bool = True


def quest_score(q: QuestSignals, now: datetime | None = None) -> float:
    """Rank work without collapsing unlike rewards into one stored currency.

    The score is only a scheduling instrument. Money, XP and long-term business
    value remain separate rewards in storage/UI.
    """
    now = now or datetime.now(timezone.utc)
    score = float(q.priority)
    score += min(q.money_now / 100.0, 100.0)
    score += min(q.xp * 0.35, 50.0)
    score += q.business_value * 0.8
    score += q.skill_value * 0.35
    score += q.unblock_value * 1.1

    if q.deadline:
        deadline = q.deadline if q.deadline.tzinfo else q.deadline.replace(tzinfo=timezone.utc)
        minutes_left = (deadline - now).total_seconds() / 60
        if minutes_left <= 0:
            score += 120
        elif minutes_left <= 60:
            score += 90
        elif minutes_left <= 6 * 60:
            score += 55
        elif minutes_left <= 24 * 60:
            score += 30
        elif minutes_left <= 7 * 24 * 60:
            score += 12

    if q.estimate_minutes:
        # Small executable steps get a modest advantage when value is similar.
        score += max(0, 20 - min(q.estimate_minutes, 120) / 6)

    return round(score, 2)


def choose_now(items: list[tuple[str, QuestSignals]], now: datetime | None = None) -> str | None:
    if not items:
        return None
    return max(items, key=lambda item: quest_score(item[1], now))[0]
