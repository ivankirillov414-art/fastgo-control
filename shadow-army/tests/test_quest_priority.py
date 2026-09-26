from datetime import datetime, timedelta, timezone

from app.quest_priority import QuestSignals, choose_now, quest_score


def test_deadline_can_make_small_quest_the_best_next_action():
    now = datetime(2026, 9, 1, 15, 0, tzinfo=timezone.utc)
    items = [
        ("future-business", QuestSignals(business_value=90, xp=80, estimate_minutes=120)),
        ("urgent-money", QuestSignals(deadline=now + timedelta(minutes=25), money_now=500, xp=10, estimate_minutes=15)),
    ]
    assert choose_now(items, now) == "urgent-money"


def test_long_term_business_value_is_not_lost():
    now = datetime(2026, 9, 1, 15, 0, tzinfo=timezone.utc)
    build = QuestSignals(business_value=100, unblock_value=70, xp=80)
    trivial = QuestSignals(priority=50, xp=5)
    assert quest_score(build, now) > quest_score(trivial, now)


def test_reward_dimensions_remain_independent_inputs():
    q = QuestSignals(money_now=1000, xp=25, business_value=80, skill_value=40)
    assert q.money_now == 1000
    assert q.xp == 25
    assert q.business_value == 80
    assert q.skill_value == 40
