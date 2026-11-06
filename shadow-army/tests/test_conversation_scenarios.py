import pytest

from app.conversation_state import ConversationState, MessageIntent, route_message


def S(project=True, task=True):
    return ConversationState(
        active_project_id="third-arm" if project else None,
        current_task_id="task-1" if task else None,
        awaiting_result=task,
    )


@pytest.mark.parametrize("text,expected,state", [
    ("Что дальше?", MessageIntent.NEXT, S(True, False)),
    ("Дальше", MessageIntent.NEXT, S(True, False)),
    ("Что теперь", MessageIntent.NEXT, S(True, False)),
    ("Следующая задача", MessageIntent.NEXT, S(True, False)),
    ("Что делать?", MessageIntent.NEXT, S(True, False)),
    ("120 мм", MessageIntent.RESULT, S()),
    ("120x80x40 мм", MessageIntent.RESULT, S()),
    ("вес до 500 г", MessageIntent.RESULT, S()),
    ("места 30 на 40 см", MessageIntent.RESULT, S()),
    ("струбцина", MessageIntent.RESULT, S()),
    ("выбираю второй вариант", MessageIntent.RESULT, S()),
    ("готово", MessageIntent.RESULT, S()),
    ("сделал", MessageIntent.RESULT, S()),
    ("не получилось", MessageIntent.RESULT, S()),
    ("деталь сломалась при тесте", MessageIntent.RESULT, S()),
    ("Проекты", MessageIntent.LIST_PROJECTS, S()),
    ("Мои проекты", MessageIntent.LIST_PROJECTS, S()),
    ("Покажи проекты", MessageIntent.LIST_PROJECTS, S()),
    ("/start", MessageIntent.COMMAND, S()),
    ("/status", MessageIntent.COMMAND, S()),
    ("/help", MessageIntent.COMMAND, S()),
    ("Создай проект Робот", MessageIntent.CREATE_PROJECT, S()),
    ("Новый проект Манипулятор", MessageIntent.CREATE_PROJECT, S()),
    ("Хочу создать проект тест", MessageIntent.CREATE_PROJECT, S()),
    ("Какой мотор лучше?", MessageIntent.FREEFORM, S(True, False)),
    ("Подбери редуктор", MessageIntent.FREEFORM, S(True, False)),
    ("Запомни эту идею", MessageIntent.FREEFORM, S(True, False)),
    ("Привет", MessageIntent.FREEFORM, S(False, False)),
    ("Что дальше по третьей руке?", MessageIntent.NEXT, S(True, False)),
    ("дальше пожалуйста", MessageIntent.NEXT, S(True, False)),
    ("что делать теперь", MessageIntent.NEXT, S(True, False)),
    ("примерно 12 сантиметров", MessageIntent.RESULT, S()),
    ("фото рабочего места готово", MessageIntent.RESULT, S()),
    ("крепление к краю стола", MessageIntent.RESULT, S()),
    ("максимум полкило", MessageIntent.RESULT, S()),
    ("да", MessageIntent.RESULT, S()),
    ("нет", MessageIntent.RESULT, S()),
    ("вариант 3", MessageIntent.RESULT, S()),
    ("проверил, держит нормально", MessageIntent.RESULT, S()),
    ("напечатал прототип", MessageIntent.RESULT, S()),
])
def test_batch_dialogue_matrix(text, expected, state):
    assert route_message(text, state) == expected


def test_long_chain_contract():
    idle = ConversationState(active_project_id="third-arm")
    assert route_message("Что дальше?", idle) == MessageIntent.NEXT
    waiting = ConversationState("third-arm", "measure", True)
    assert route_message("120x80x40 мм, 500 г", waiting) == MessageIntent.RESULT
    idle_again = ConversationState("third-arm", None, False)
    assert route_message("Дальше", idle_again) == MessageIntent.NEXT
    waiting_again = ConversationState("third-arm", "workspace", True)
    assert route_message("30x40 см", waiting_again) == MessageIntent.RESULT
