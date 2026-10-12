import os
import sys
import pytest

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import TaskPriority, TaskStatus
from storage import storage
from tools import (
    add_task, list_tasks, update_task, complete_task,
    prioritize_tasks, build_daily_plan, rescue_my_day
)
from agent import agent

def test_add_and_list_tasks():
    res = add_task(
        title="Test Automated Task Intake",
        priority="HIGH",
        estimated_minutes=45,
        deadline="Today 4 PM",
        description="Verify automated test intake functionality",
        category="Testing"
    )
    assert res["status"] == "success"
    task_id = res["task"]["id"]
    assert res["task"]["title"] == "Test Automated Task Intake"

    # List tasks
    list_res = list_tasks()
    assert list_res["status"] == "success"
    assert any(t["id"] == task_id for t in list_res["tasks"])

    # Clean up
    storage.delete_task(task_id)

def test_complete_task():
    res = add_task(title="Task to complete", priority="MEDIUM")
    task_id = res["task"]["id"]

    comp_res = complete_task(task_id)
    assert comp_res["status"] == "success"
    assert comp_res["task"]["status"] == TaskStatus.COMPLETED

    storage.delete_task(task_id)

def test_prioritization_algorithm():
    res = prioritize_tasks(available_hours=3.0)
    assert res["status"] == "success"
    assert "recommended_today" in res
    assert "rationale" in res
    assert res["planned_minutes"] <= 180

def test_build_daily_plan():
    res = build_daily_plan(available_hours=4.0)
    assert res["status"] == "success"
    plan = res["plan"]
    assert len(plan["schedule_blocks"]) > 0
    assert plan["available_hours"] == 4.0
    assert plan["total_planned_minutes"] > 0

def test_rescue_my_day():
    res = rescue_my_day(stress_level="critical", hours_available=2.5)
    assert res["status"] == "success"
    rescue_plan = res["rescue_plan"]
    assert len(rescue_plan["actions"]) == 3
    assert "calm_reassurance" in rescue_plan
    # Verify every action has the 4 required parts
    for action in rescue_plan["actions"]:
        assert "what_to_do" in action
        assert "why_it_matters" in action
        assert "estimated_time" in action
        assert "simple_micro_action" in action

def test_agent_intake_reasoning():
    # Test natural language intake prompt
    prompt = "I have a client website deadline tomorrow, two invoices to send, a meeting at 3 PM, and four hours to work today."
    chat_resp = agent.process_message(prompt, available_hours=4.0)
    assert chat_resp is not None
    assert len(chat_resp.tool_calls) > 0
    # Check that add_task tool was called
    tool_names = [tc.tool_name for tc in chat_resp.tool_calls]
    assert "add_task" in tool_names
    assert "build_daily_plan" in tool_names

def test_agent_rescue_reasoning():
    # Test overwhelmed prompt
    prompt = "I'm overwhelmed. I have too much work and don't know where to start."
    chat_resp = agent.process_message(prompt, available_hours=3.0)
    assert chat_resp is not None
    assert chat_resp.rescue_plan is not None
    assert len(chat_resp.rescue_plan.actions) == 3
    tool_names = [tc.tool_name for tc in chat_resp.tool_calls]
    assert "rescue_my_day" in tool_names

if __name__ == "__main__":
    pytest.main(["-v", __file__])
