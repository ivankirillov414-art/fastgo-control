import pytest

from app.conversation_state import ConversationState, MessageIntent, route_message


@pytest.mark.parametrize("text", [
    "Что дальше?", "что дальше", "Что теперь?", "Дальше", "Что делать?", "Следующая задача",
])
def test_next_phrases_keep_project_context(text):
    state = ConversationState(active_project_id="third-arm")
    assert route_message(text, state) == MessageIntent.NEXT


@pytest.mark.parametrize("text", [
    "120 x 80 x 40 мм", "500 грамм", "примерно 15 сантиметров", "сделал замер: 120 мм",
    "фото отправлю следующим сообщением", "струбцина", "готово, получилось нормально",
])
def test_plain_reply_is_result_when_task_waits(text):
    state = ConversationState(active_project_id="third-arm", current_task_id="measure", awaiting_result=True)
    assert route_message(text, state) == MessageIntent.RESULT


@pytest.mark.parametrize("text", ["/status", "/start", "/help"])
def test_commands_are_not_consumed_as_results(text):
    state = ConversationState(active_project_id="third-arm", current_task_id="measure", awaiting_result=True)
    assert route_message(text, state) == MessageIntent.COMMAND


@pytest.mark.parametrize("text", ["Проекты", "Мои проекты", "Покажи проекты"])
def test_project_list_commands(text):
    state = ConversationState(active_project_id="third-arm", current_task_id="measure", awaiting_result=True)
    assert route_message(text, state) == MessageIntent.LIST_PROJECTS


@pytest.mark.parametrize("text", ["Создай проект Манипулятор", "Новый проект: робот", "Хочу создать проект тест"])
def test_new_project_overrides_waiting_result(text):
    state = ConversationState(active_project_id="third-arm", current_task_id="measure", awaiting_result=True)
    assert route_message(text, state) == MessageIntent.CREATE_PROJECT


def test_freeform_without_current_task_stays_freeform():
    assert route_message("Подскажи, какой мотор лучше", ConversationState(active_project_id="third-arm")) == MessageIntent.FREEFORM


def test_result_then_next_state_transition_contract():
    waiting = ConversationState(active_project_id="third-arm", current_task_id="measure", awaiting_result=True)
    assert route_message("120 мм", waiting) == MessageIntent.RESULT
    completed = ConversationState(active_project_id="third-arm", current_task_id=None, awaiting_result=False)
    assert route_message("Что дальше?", completed) == MessageIntent.NEXT
