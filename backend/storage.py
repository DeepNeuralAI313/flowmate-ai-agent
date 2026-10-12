import json
import os
import uuid
import datetime
from typing import List, Optional, Dict, Any
from models import Task, TaskPriority, TaskStatus, WorkdayPlan

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
TASKS_FILE = os.path.join(DATA_DIR, "tasks.json")
PLAN_FILE = os.path.join(DATA_DIR, "plan.json")

def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)

def get_initial_seed_tasks() -> List[Task]:
    return [
        Task(
            id="task-1",
            title="Finalize client website redesign",
            description="Complete responsive layout adjustments and test contact form submission.",
            priority=TaskPriority.URGENT,
            estimated_minutes=90,
            deadline="Today, 5:00 PM",
            status=TaskStatus.IN_PROGRESS,
            category="Client Work"
        ),
        Task(
            id="task-2",
            title="Send monthly retainer invoices (Acme & Globex)",
            description="Generate PDF invoices in QuickBooks and dispatch via email.",
            priority=TaskPriority.HIGH,
            estimated_minutes=30,
            deadline="Today, 6:00 PM",
            status=TaskStatus.PENDING,
            category="Finance"
        ),
        Task(
            id="task-3",
            title="Attend design sync with engineering team",
            description="Review v2 dashboard wireframes and answer design spec questions.",
            priority=TaskPriority.HIGH,
            estimated_minutes=45,
            deadline="Today, 3:00 PM",
            status=TaskStatus.PENDING,
            category="Meetings"
        ),
        Task(
            id="task-4",
            title="Draft project proposal for NextGen mobile app",
            description="Outline scope of work, technical milestones, and estimated budget.",
            priority=TaskPriority.MEDIUM,
            estimated_minutes=60,
            deadline="Tomorrow, 12:00 PM",
            status=TaskStatus.PENDING,
            category="Business Dev"
        ),
        Task(
            id="task-5",
            title="Review pull requests for authentication refactor",
            description="Verify token refresh logic and test edge cases.",
            priority=TaskPriority.LOW,
            estimated_minutes=30,
            deadline="Tomorrow, 5:00 PM",
            status=TaskStatus.PENDING,
            category="Development"
        )
    ]

class TaskStorage:
    def __init__(self):
        ensure_data_dir()
        if not os.path.exists(TASKS_FILE):
            self.save_all_tasks(get_initial_seed_tasks())

    def get_all_tasks(self) -> List[Task]:
        ensure_data_dir()
        if not os.path.exists(TASKS_FILE):
            return get_initial_seed_tasks()
        try:
            with open(TASKS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [Task(**item) for item in data]
        except Exception:
            return get_initial_seed_tasks()

    def save_all_tasks(self, tasks: List[Task]):
        ensure_data_dir()
        with open(TASKS_FILE, "w", encoding="utf-8") as f:
            json.dump([t.model_dump() for t in tasks], f, indent=2)

    def add_task(self, title: str, priority: TaskPriority = TaskPriority.MEDIUM,
                 estimated_minutes: int = 30, deadline: Optional[str] = None,
                 description: str = "", category: str = "General") -> Task:
        tasks = self.get_all_tasks()
        new_id = f"task-{uuid.uuid4().hex[:6]}"
        new_task = Task(
            id=new_id,
            title=title,
            description=description,
            priority=priority,
            estimated_minutes=estimated_minutes,
            deadline=deadline,
            status=TaskStatus.PENDING,
            category=category,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
        )
        tasks.append(new_task)
        self.save_all_tasks(tasks)
        return new_task

    def update_task(self, task_id: str, updates: Dict[str, Any]) -> Optional[Task]:
        tasks = self.get_all_tasks()
        target = None
        for i, t in enumerate(tasks):
            if t.id == task_id:
                task_dict = t.model_dump()
                task_dict.update(updates)
                target = Task(**task_dict)
                tasks[i] = target
                break
        if target:
            self.save_all_tasks(tasks)
        return target

    def complete_task(self, task_id: str) -> Optional[Task]:
        tasks = self.get_all_tasks()
        target = None
        for i, t in enumerate(tasks):
            if t.id == task_id:
                t.status = TaskStatus.COMPLETED
                t.completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
                target = t
                break
        if target:
            self.save_all_tasks(tasks)
        return target

    def delete_task(self, task_id: str) -> bool:
        tasks = self.get_all_tasks()
        initial_len = len(tasks)
        tasks = [t for t in tasks if t.id != task_id]
        if len(tasks) < initial_len:
            self.save_all_tasks(tasks)
            return True
        return False

    def get_plan(self) -> Optional[WorkdayPlan]:
        ensure_data_dir()
        if not os.path.exists(PLAN_FILE):
            return None
        try:
            with open(PLAN_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return WorkdayPlan(**data)
        except Exception:
            return None

    def save_plan(self, plan: WorkdayPlan):
        ensure_data_dir()
        with open(PLAN_FILE, "w", encoding="utf-8") as f:
            json.dump(plan.model_dump(), f, indent=2)

storage = TaskStorage()
