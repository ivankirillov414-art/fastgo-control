from unittest.mock import MagicMock

from app.commander import CommanderService


def commander():
    instance = CommanderService.__new__(CommanderService)
    instance.db = MagicMock()
    return instance


def test_classifies_question():
    assert commander().classify("Какой двигатель лучше?") == "QUESTION"


def test_classifies_project():
    assert commander().classify("Хочу сделать роботизированную руку") == "PROJECT"


def test_classifies_task():
    assert commander().classify("Подбери двигатель до 5000 рублей") == "TASK"
