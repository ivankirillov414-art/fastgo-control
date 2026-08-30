import re

from sqlalchemy.orm import Session

from .keeper import KeeperService
from .manager import ManagerService
from .models import Event


class CommanderService:
    """Commander E: classifies intent and coordinates Keeper + Manager without external side effects."""
    QUESTION_WORDS=("как","какой","какая","какие","почему","сколько","можно ли","что такое")
    PROJECT_WORDS=("проект","сделаем","создать","построить","разработать","запустить","хочу сделать")

    def __init__(self, db: Session):
        self.db=db; self.keeper=KeeperService(db); self.manager=ManagerService(db)

    def classify(self, text: str) -> str:
        value=text.strip().casefold()
        if any(word in value for word in self.PROJECT_WORDS): return "PROJECT"
        if value.endswith("?") or any(value.startswith(word) for word in self.QUESTION_WORDS): return "QUESTION"
        return "TASK"

    def handle(self, text: str, project_id: str | None=None) -> dict:
        request_type=self.classify(text)
        subject=self._subject(text)
        context=self.keeper.context_pack(subject,project_id=project_id,limit=20)
        result={"type":request_type,"intent":text.strip(),"subject":subject,"confidence":0.75,"risk":"low","approval_required":False,"delegated_to":["keeper"],"context":context}
        if request_type in {"TASK","PROJECT"}:
            result["delegated_to"].append("manager")
            result["planning_context"]=self.manager.planning_context(subject,project_id=project_id)
        if project_id:
            try: result["project"]=self.manager.project_context(project_id)
            except ValueError: result["project_error"]="Project not found"
        self.db.add(Event(actor="commander",action="REQUEST_CLASSIFIED",target=project_id,reason="Commander E orchestration",payload={"type":request_type,"subject":subject,"delegated_to":result["delegated_to"]}))
        self.db.commit()
        return result

    @staticmethod
    def _subject(text: str) -> str:
        cleaned=re.sub(r"[^\w\s-]"," ",text,flags=re.UNICODE)
        words=[w for w in cleaned.split() if len(w)>2]
        return " ".join(words[-6:]) if words else text.strip()
