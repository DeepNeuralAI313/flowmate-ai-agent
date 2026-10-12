from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import datetime

class TaskPriority(str, Enum):
    URGENT = "URGENT"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"

class Task(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    priority: TaskPriority = TaskPriority.MEDIUM
    estimated_minutes: int = 30
    deadline: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    category: Optional[str] = "General"
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    completed_at: Optional[str] = None

class ScheduleBlock(BaseModel):
    time_slot: str
    task_id: str
    task_title: str
    duration_minutes: int
    focus_objective: str

class WorkdayPlan(BaseModel):
    date: str = Field(default_factory=lambda: datetime.date.today().isoformat())
    available_hours: float = 4.0
    tasks: List[Task] = []
    schedule_blocks: List[ScheduleBlock] = []
    summary: str = ""
    total_planned_minutes: int = 0
    buffer_minutes: int = 0

class RescueAction(BaseModel):
    step_number: int
    what_to_do: str
    why_it_matters: str
    estimated_time: str
    simple_micro_action: str
    task_id: Optional[str] = None

class RescuePlan(BaseModel):
    calm_reassurance: str
    actions: List[RescueAction]
    time_budget_minutes: int
    encouragement: str

class AgentToolCall(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]
    result: Optional[Any] = None
    status: str = "success"

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default-session"
    available_hours: Optional[float] = 4.0

class ChatResponse(BaseModel):
    response_text: str
    tool_calls: List[AgentToolCall] = []
    tasks: List[Task] = []
    current_plan: Optional[WorkdayPlan] = None
    rescue_plan: Optional[RescuePlan] = None
    mode: Optional[str] = "standard"

class BedrockConfig(BaseModel):
    aws_region: str = "us-east-1"
    model_id: str = "anthropic.claude-3-haiku-20240307-v1:0"
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_session_token: Optional[str] = None
