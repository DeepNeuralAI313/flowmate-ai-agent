from typing import Dict, Any, List, Optional
from models import Task, TaskPriority, TaskStatus, WorkdayPlan, ScheduleBlock, RescuePlan, RescueAction
from storage import storage
import datetime

def add_task(
    title: str,
    priority: str = "MEDIUM",
    estimated_minutes: int = 30,
    deadline: Optional[str] = None,
    description: str = "",
    category: str = "General"
) -> Dict[str, Any]:
    """Adds a new task to the user's workload."""
    try:
        norm_priority = TaskPriority[priority.upper()]
    except Exception:
        norm_priority = TaskPriority.MEDIUM

    created = storage.add_task(
        title=title,
        priority=norm_priority,
        estimated_minutes=max(5, int(estimated_minutes)),
        deadline=deadline,
        description=description,
        category=category
    )
    return {
        "status": "success",
        "message": f"Added task '{created.title}' ({created.estimated_minutes}m, {created.priority.value})",
        "task": created.model_dump()
    }

def list_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieves all active or completed tasks filtered by status and priority."""
    tasks = storage.get_all_tasks()
    if status:
        tasks = [t for t in tasks if t.status.value.lower() == status.lower()]
    if priority:
        tasks = [t for t in tasks if t.priority.value.lower() == priority.lower()]
    return {
        "status": "success",
        "count": len(tasks),
        "tasks": [t.model_dump() for t in tasks]
    }

def update_task(task_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Modifies properties of an existing task."""
    updated = storage.update_task(task_id, updates)
    if not updated:
        return {"status": "error", "message": f"Task with ID {task_id} not found."}
    return {
        "status": "success",
        "message": f"Updated task '{updated.title}'",
        "task": updated.model_dump()
    }

def complete_task(task_id: str) -> Dict[str, Any]:
    """Marks a task as completed."""
    completed = storage.complete_task(task_id)
    if not completed:
        return {"status": "error", "message": f"Task with ID {task_id} not found."}
    return {
        "status": "success",
        "message": f"Completed task '{completed.title}' 🎉",
        "task": completed.model_dump()
    }

def prioritize_tasks(available_hours: float = 4.0, strategy: str = "urgency_and_impact") -> Dict[str, Any]:
    """
    Ranks pending tasks using an explainable algorithm based on:
    - Urgency (deadlines today vs future)
    - Importance (priority level)
    - Fit within available hours
    """
    all_tasks = storage.get_all_tasks()
    pending = [t for t in all_tasks if t.status != TaskStatus.COMPLETED]

    priority_weights = {
        TaskPriority.URGENT: 100,
        TaskPriority.HIGH: 70,
        TaskPriority.MEDIUM: 40,
        TaskPriority.LOW: 15
    }

    scored_tasks = []
    for t in pending:
        score = priority_weights.get(t.priority, 30)
        # Check deadline urgency
        deadline_lower = (t.deadline or "").lower()
        if "today" in deadline_lower or "asap" in deadline_lower:
            score += 50
        elif "tomorrow" in deadline_lower:
            score += 25
        scored_tasks.append((score, t))

    scored_tasks.sort(key=lambda x: x[0], reverse=True)
    ranked = [item[1] for item in scored_tasks]

    total_avail_minutes = int(available_hours * 60)
    current_sum = 0
    in_budget = []
    overflow = []

    for t in ranked:
        if current_sum + t.estimated_minutes <= total_avail_minutes:
            in_budget.append(t)
            current_sum += t.estimated_minutes
        else:
            overflow.append(t)

    return {
        "status": "success",
        "strategy": strategy,
        "available_minutes": total_avail_minutes,
        "planned_minutes": current_sum,
        "recommended_today": [t.model_dump() for t in in_budget],
        "deferred": [t.model_dump() for t in overflow],
        "rationale": f"Selected top {len(in_budget)} tasks prioritizing upcoming deadlines and high impact, fitting comfortably within your {available_hours}h focus window."
    }

def build_daily_plan(available_hours: float = 4.0, date: Optional[str] = None) -> Dict[str, Any]:
    """Generates an organized, time-blocked daily plan matching the user's available hours."""
    prioritization = prioritize_tasks(available_hours=available_hours)
    recommended = [Task(**t) for t in prioritization["recommended_today"]]

    blocks: List[ScheduleBlock] = []
    # Build a reasonable timeline starting from next full hour
    current_time = datetime.datetime.now()
    start_hour = (current_time.hour + 1) if current_time.minute > 30 else current_time.hour
    start_min = 0 if current_time.minute > 30 else 30

    slot_dt = current_time.replace(hour=start_hour % 24, minute=start_min, second=0, microsecond=0)

    total_minutes = 0
    for t in recommended:
        slot_str = slot_dt.strftime("%I:%M %p")
        end_dt = slot_dt + datetime.timedelta(minutes=t.estimated_minutes)
        slot_label = f"{slot_str} - {end_dt.strftime('%I:%M %p')}"

        blocks.append(ScheduleBlock(
            time_slot=slot_label,
            task_id=t.id,
            task_title=t.title,
            duration_minutes=t.estimated_minutes,
            focus_objective=f"Deep work on: {t.title}. {t.description}"
        ))

        total_minutes += t.estimated_minutes
        slot_dt = end_dt + datetime.timedelta(minutes=15)  # 15m restorative breathing/transition buffer

    avail_min = int(available_hours * 60)
    buffer = max(0, avail_min - total_minutes)

    plan = WorkdayPlan(
        date=date or datetime.date.today().isoformat(),
        available_hours=available_hours,
        tasks=recommended,
        schedule_blocks=blocks,
        summary=f"Optimized {len(recommended)} high-impact tasks into realistic time blocks with restorative 15-minute buffers.",
        total_planned_minutes=total_minutes,
        buffer_minutes=buffer
    )
    storage.save_plan(plan)

    return {
        "status": "success",
        "plan": plan.model_dump(),
        "message": f"Daily plan created with {len(blocks)} focus blocks spanning {total_minutes // 60}h {total_minutes % 60}m."
    }

def rescue_my_day(stress_level: str = "high", hours_available: float = 3.0) -> Dict[str, Any]:
    """
    Signature delightful feature:
    Simplifies an overwhelming workload into a calm, non-patronizing 3-step action plan.
    Provides: What to do, Why it matters, Estimated time, and a micro next action.
    """
    all_tasks = storage.get_all_tasks()
    pending = [t for t in all_tasks if t.status != TaskStatus.COMPLETED]

    # Sort pending by urgency
    pending_sorted = sorted(
        pending,
        key=lambda x: (
            0 if x.priority == TaskPriority.URGENT else (1 if x.priority == TaskPriority.HIGH else 2),
            x.estimated_minutes
        )
    )

    actions: List[RescueAction] = []

    if len(pending_sorted) >= 1:
        t1 = pending_sorted[0]
        actions.append(RescueAction(
            step_number=1,
            what_to_do=f"Finish: {t1.title}",
            why_it_matters="This is your single biggest bottleneck. Clearing it removes 80% of immediate stress.",
            estimated_time=f"{min(45, t1.estimated_minutes)} minutes",
            simple_micro_action=f"Open the relevant document or editor right now and write or fix the first 3 lines.",
            task_id=t1.id
        ))
    else:
        actions.append(RescueAction(
            step_number=1,
            what_to_do="Define your single priority deliverable",
            why_it_matters="Clarity eliminates overwhelm.",
            estimated_time="10 minutes",
            simple_micro_action="Write down one sentence defining what done looks like today."
        ))

    if len(pending_sorted) >= 2:
        t2 = pending_sorted[1]
        actions.append(RescueAction(
            step_number=2,
            what_to_do=f"Dispatch quick win: {t2.title}",
            why_it_matters="A fast completion gives you momentum and closes open client communication loops.",
            estimated_time=f"{min(30, t2.estimated_minutes)} minutes",
            simple_micro_action="Send the email, invoice, or update message before taking lunch.",
            task_id=t2.id
        ))
    else:
        actions.append(RescueAction(
            step_number=2,
            what_to_do="Take a deliberate 10-minute mental reset",
            why_it_matters="Continuous context-switching drains working memory.",
            estimated_time="10 minutes",
            simple_micro_action="Step away from the screen and drink a glass of water."
        ))

    if len(pending_sorted) >= 3:
        t3 = pending_sorted[2]
        actions.append(RescueAction(
            step_number=3,
            what_to_do=f"Outline or progress: {t3.title}",
            why_it_matters="You don't have to finish everything today. A 20-minute head start makes tomorrow easy.",
            estimated_time=f"{min(30, t3.estimated_minutes)} minutes",
            simple_micro_action="Jot down a quick 3-bullet checklist so you know where to pick up next.",
            task_id=t3.id
        ))
    else:
        actions.append(RescueAction(
            step_number=3,
            what_to_do="Protect your evening boundary",
            why_it_matters="Rest is part of the work. You did enough for one day.",
            estimated_time="5 minutes",
            simple_micro_action="Shut down your laptop and write tomorrow's top task on a sticky note."
        ))

    rescue_plan = RescuePlan(
        calm_reassurance="Take a deep breath. Overwhelm is just having too many browser tabs open in your mind. We are parking everything else for today.",
        actions=actions,
        time_budget_minutes=sum([int(a.estimated_time.split()[0]) for a in actions if a.estimated_time.split()[0].isdigit()]),
        encouragement="You do not need to do everything today. You only need to do Step 1. Start with the micro-action below."
    )

    return {
        "status": "success",
        "rescue_plan": rescue_plan.model_dump()
    }

def save_plan(plan_data: Dict[str, Any]) -> Dict[str, Any]:
    """Persists a modified or custom workday plan."""
    plan = WorkdayPlan(**plan_data)
    storage.save_plan(plan)
    return {
        "status": "success",
        "message": f"Workday plan for {plan.date} saved successfully.",
        "plan": plan.model_dump()
    }

TOOL_REGISTRY = {
    "add_task": add_task,
    "list_tasks": list_tasks,
    "update_task": update_task,
    "complete_task": complete_task,
    "prioritize_tasks": prioritize_tasks,
    "build_daily_plan": build_daily_plan,
    "rescue_my_day": rescue_my_day,
    "save_plan": save_plan
}

BEDROCK_TOOL_DEFINITIONS = [
    {
        "toolSpec": {
            "name": "add_task",
            "description": "Add a new task to the user's workload with title, priority, estimated minutes, deadline, and category.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Clear action-oriented task title"},
                        "priority": {"type": "string", "enum": ["URGENT", "HIGH", "MEDIUM", "LOW"]},
                        "estimated_minutes": {"type": "integer", "description": "Estimated duration in minutes (e.g. 30, 45, 60)"},
                        "deadline": {"type": "string", "description": "Deadline description or time"},
                        "description": {"type": "string", "description": "Additional context or instructions"},
                        "category": {"type": "string", "description": "Category such as Client Work, Finance, Meetings"}
                    },
                    "required": ["title"]
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "list_tasks",
            "description": "Retrieve tasks from storage with optional filtering by status (PENDING, COMPLETED) or priority.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string", "description": "Task status filter"},
                        "priority": {"type": "string", "description": "Priority filter"}
                    }
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "update_task",
            "description": "Update properties of an existing task by its ID.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string", "description": "The ID of the task to update"},
                        "updates": {"type": "object", "description": "Dictionary of fields to update"}
                    },
                    "required": ["task_id", "updates"]
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "complete_task",
            "description": "Mark a task as completed by its ID.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string", "description": "The ID of the task"}
                    },
                    "required": ["task_id"]
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "prioritize_tasks",
            "description": "Intelligently prioritize active tasks given available working hours and urgency.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "available_hours": {"type": "number", "description": "Total available working hours today"},
                        "strategy": {"type": "string", "description": "Prioritization strategy name"}
                    }
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "build_daily_plan",
            "description": "Build an actionable, time-blocked workday plan fitting within available working hours.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "available_hours": {"type": "number", "description": "Available working hours (e.g. 4.0)"},
                        "date": {"type": "string", "description": "Plan date in YYYY-MM-DD"}
                    }
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "rescue_my_day",
            "description": "Signature calming feature: Rescue an overwhelmed user with a calm, 3-step micro-action plan.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "stress_level": {"type": "string", "description": "User stress level: high, medium, critical"},
                        "hours_available": {"type": "number", "description": "Hours remaining in workday"}
                    }
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "save_plan",
            "description": "Save an updated workday plan to persistent storage.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "plan_data": {"type": "object", "description": "The full plan data dictionary"}
                    },
                    "required": ["plan_data"]
                }
            }
        }
    }
]
