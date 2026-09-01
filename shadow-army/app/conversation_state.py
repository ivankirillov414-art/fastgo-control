from dataclasses import dataclass
from enum import Enum


class MessageIntent(str, Enum):
    NEXT = "next"
    RESULT = "result"
    CREATE_PROJECT = "create_project"
    LIST_PROJECTS = "list_projects"
    COMMAND = "command"
    FREEFORM = "freeform"


@dataclass(frozen=True)
class ConversationState:
    active_project_id: str | None = None
    current_task_id: str | None = None
    awaiting_result: bool = False


NEXT_PHRASES = ("что дальше", "что теперь", "дальше", "следующая задача", "что делать")
CREATE_PHRASES = ("создай проект", "создать проект", "новый проект")
LIST_PHRASES = ("проекты", "мои проекты", "покажи проекты")


def route_message(text: str, state: ConversationState) -> MessageIntent:
    value = " ".join(text.casefold().replace("ё", "е").split())
    if value.startswith("/"):
        return MessageIntent.COMMAND
    if value in LIST_PHRASES:
        return MessageIntent.LIST_PROJECTS
    if any(p in value for p in CREATE_PHRASES):
        return MessageIntent.CREATE_PROJECT
    if any(p in value for p in NEXT_PHRASES):
        return MessageIntent.NEXT
    if state.awaiting_result and state.current_task_id:
        return MessageIntent.RESULT
    return MessageIntent.FREEFORM
