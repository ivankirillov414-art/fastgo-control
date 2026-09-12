import json
from urllib import request

from sqlalchemy.orm import Session

from ..commander import CommanderService
from ..config import get_settings


class TelegramBot:
    """Thin Telegram interface for the existing @FastGoServiceBot.

    Telegram is only transport. All reasoning stays in Commander/agents.
    """

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.commander = CommanderService(db)

    def handle_update(self, update: dict) -> dict | None:
        message = update.get("message") or update.get("edited_message")
        if not message:
            return None
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        text = (message.get("text") or "").strip()
        if not chat_id or not text:
            return None

        if text == "/start":
            answer = "👑 Теневая армия\n\nКомандир E на связи. Напиши задачу обычным текстом."
        elif text == "/status":
            answer = "👑 Командир E — активен\n🧠 Хранитель E — активен\n⚔️ Управляющий E — активен"
        else:
            result = self.commander.handle(text)
            answer = result.get("answer") or "Задача принята."

        return {"chat_id": chat_id, "text": answer}

    def send(self, chat_id: int, text: str) -> dict:
        if not self.settings.telegram_bot_token:
            raise RuntimeError("Telegram bot token is not configured")
        payload = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
        req = request.Request(
            f"https://api.telegram.org/bot{self.settings.telegram_bot_token}/sendMessage",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
