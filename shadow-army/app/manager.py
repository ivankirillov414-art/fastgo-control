from sqlalchemy import select
from sqlalchemy.orm import Session

from .keeper import KeeperService
from .models import Event, Project, ProjectStatus, Quest, Stage, Task, VerificationMode, WorkStatus


class ManagerService:
    """Manager E: projects, stages, quests and tasks informed by Keeper memory."""
    def __init__(self, db: Session):
        self.db=db
        self.keeper=KeeperService(db)

    def create_project(self, name: str, goal: str, success_criteria: str, constraints: dict | None=None, priority: int=50) -> Project:
        project=Project(name=name.strip(),goal=goal.strip(),success_criteria=success_criteria.strip(),constraints=constraints or {},status=ProjectStatus.ACTIVE,priority=max(0,min(100,priority)))
        self.db.add(project); self.db.flush(); self._event("PROJECT_CREATED",project.id,{"name":project.name}); self.db.commit(); self.db.refresh(project); return project

    def add_stage(self, project_id: str, name: str, goal: str, position: int=0) -> Stage:
        if self.db.get(Project,project_id) is None: raise ValueError("Project not found")
        stage=Stage(project_id=project_id,name=name.strip(),goal=goal.strip(),position=position,status=WorkStatus.AVAILABLE if position==0 else WorkStatus.PLANNED)
        self.db.add(stage); self.db.flush(); self._event("STAGE_CREATED",stage.id,{"project_id":project_id}); self.db.commit(); self.db.refresh(stage); return stage

    def add_quest(self, stage_id: str, title: str, result: str, success_criteria: str, verification_mode: VerificationMode=VerificationMode.USER, priority: int=50) -> Quest:
        if self.db.get(Stage,stage_id) is None: raise ValueError("Stage not found")
        quest=Quest(stage_id=stage_id,title=title.strip(),result=result.strip(),success_criteria=success_criteria.strip(),verification_mode=verification_mode,status=WorkStatus.AVAILABLE,priority=max(0,min(100,priority)))
        self.db.add(quest); self.db.flush(); self._event("QUEST_CREATED",quest.id,{"stage_id":stage_id}); self.db.commit(); self.db.refresh(quest); return quest

    def add_task(self, quest_id: str, title: str, description: str="", estimate_minutes: int | None=None, executor: str | None=None, depends_on: list[str] | None=None, blocker: str | None=None) -> Task:
        if self.db.get(Quest,quest_id) is None: raise ValueError("Quest not found")
        deps=depends_on or []; status=WorkStatus.BLOCKED if blocker or deps else WorkStatus.AVAILABLE
        task=Task(quest_id=quest_id,title=title.strip(),description=description.strip(),estimate_minutes=estimate_minutes,executor=executor,depends_on=deps,blocker=blocker,status=status)
        self.db.add(task); self.db.flush(); self._event("TASK_CREATED",task.id,{"quest_id":quest_id,"status":status.value}); self.db.commit(); self.db.refresh(task); return task

    def planning_context(self, subject: str, project_id: str | None=None) -> dict:
        """Fetch only relevant long-term knowledge before planning."""
        pack=self.keeper.context_pack(subject, project_id=project_id, limit=30)
        return {"subject":subject,"known":{"facts":pack["facts"],"decisions":pack["decisions"],"lessons":pack["lessons"],"results":pack["results"],"resources":pack["resources"]},"warnings":{"conflicts":pack["conflicts"],"stale":pack["stale"]},"unknowns":pack["unknowns"]}

    def project_context(self, project_id: str) -> dict:
        project=self.db.get(Project,project_id)
        if project is None: raise ValueError("Project not found")
        stages=list(self.db.scalars(select(Stage).where(Stage.project_id==project_id).order_by(Stage.position)))
        result={"project":{"id":project.id,"name":project.name,"goal":project.goal,"success_criteria":project.success_criteria,"status":project.status.value},"memory":self.planning_context(project.name,project_id),"stages":[],"next_actions":[],"blockers":[]}
        for stage in stages:
            s={"id":stage.id,"name":stage.name,"goal":stage.goal,"status":stage.status.value,"quests":[]}
            quests=list(self.db.scalars(select(Quest).where(Quest.stage_id==stage.id).order_by(Quest.priority.desc())))
            for quest in quests:
                tasks=list(self.db.scalars(select(Task).where(Task.quest_id==quest.id)))
                q={"id":quest.id,"title":quest.title,"result":quest.result,"success_criteria":quest.success_criteria,"verification_mode":quest.verification_mode.value,"status":quest.status.value,"tasks":[]}
                for task in tasks:
                    item={"id":task.id,"title":task.title,"status":task.status.value,"estimate_minutes":task.estimate_minutes,"depends_on":task.depends_on,"blocker":task.blocker}
                    q["tasks"].append(item)
                    if task.status==WorkStatus.AVAILABLE: result["next_actions"].append(item)
                    if task.status==WorkStatus.BLOCKED: result["blockers"].append(item)
                s["quests"].append(q)
            result["stages"].append(s)
        return result

    def _event(self, action: str, target: str, payload: dict): self.db.add(Event(actor="manager",action=action,target=target,reason="Manager E project operation",payload=payload))
