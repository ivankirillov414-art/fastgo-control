import json
from dataclasses import dataclass
from urllib import request

from .config import get_settings


@dataclass
class AIResult:
    text: str
    model: str
    provider: str


class ModelRouter:
    """Small provider boundary for Shadow Army.

    The core never talks to a model vendor directly.  This keeps agents portable
    and lets CI run safely with no API key.
    """

    def __init__(self):
        self.settings = get_settings()

    @property
    def available(self) -> bool:
        return bool(self.settings.ai_api_key)

    def complete(self, system: str, user: str, capability: str = "standard") -> AIResult:
        if not self.available:
            raise RuntimeError("AI provider is not configured")

        model = self.settings.ai_model_reasoning if capability == "reasoning" else self.settings.ai_model_standard
        payload = json.dumps({
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
        }).encode("utf-8")
        req = request.Request(
            self.settings.ai_base_url.rstrip("/") + "/chat/completions",
            data=payload,
            headers={"Authorization": f"Bearer {self.settings.ai_api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=self.settings.ai_timeout_seconds) as response:
            body = json.loads(response.read().decode("utf-8"))
        return AIResult(text=body["choices"][0]["message"]["content"], model=model, provider=self.settings.ai_provider)
