import os
import uvicorn
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from typing import Dict, Any, Optional

from models import Task, TaskPriority, TaskStatus, WorkdayPlan, ChatRequest, ChatResponse, BedrockConfig
from storage import storage
from tools import TOOL_REGISTRY
from agent import agent

app = FastAPI(
    title="FlowMate AI — Workday Copilot API",
    description="Agentic workday management system powered by Amazon Bedrock",
    version="1.0.0"
)

# CORS setup for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "FlowMate AI",
        "version": "1.0.0",
        "bedrock_status": agent.check_bedrock_status()
    }

@app.get("/api/bedrock/status")
def get_bedrock_status():
    return agent.check_bedrock_status()

@app.post("/api/bedrock/config")
def update_bedrock_config(config: BedrockConfig):
    res = agent.update_bedrock_config(
        region=config.aws_region,
        model_id=config.model_id,
        access_key_id=config.aws_access_key_id,
        secret_access_key=config.aws_secret_access_key
    )
    return res

@app.post("/api/chat", response_model=ChatResponse)
def chat_with_agent(request: ChatRequest):
    try:
        response = agent.process_message(
            message=request.message,
            available_hours=request.available_hours or 4.0
        )
        return response
    except Exception as e:
        # Graceful error handling
        return ChatResponse(
            response_text="I experienced an unexpected hiccup processing that request. Don't worry—your tasks are safe! Please try sending your message again or click 'Rescue My Day'.",
            tool_calls=[],
            tasks=storage.get_all_tasks(),
            current_plan=storage.get_plan(),
            rescue_plan=None,
            mode="fallback"
        )

@app.get("/api/tasks")
def list_tasks(status: Optional[str] = None, priority: Optional[str] = None):
    return TOOL_REGISTRY["list_tasks"](status=status, priority=priority)

@app.post("/api/tasks")
def create_task(data: Dict[str, Any] = Body(...)):
    if "title" not in data or not data["title"].strip():
        raise HTTPException(status_code=400, detail="Task title is required.")
    return TOOL_REGISTRY["add_task"](
        title=data["title"],
        priority=data.get("priority", "MEDIUM"),
        estimated_minutes=int(data.get("estimated_minutes", 30)),
        deadline=data.get("deadline"),
        description=data.get("description", ""),
        category=data.get("category", "General")
    )

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: str, updates: Dict[str, Any] = Body(...)):
    res = TOOL_REGISTRY["update_task"](task_id=task_id, updates=updates)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res

@app.post("/api/tasks/{task_id}/complete")
def complete_task(task_id: str):
    res = TOOL_REGISTRY["complete_task"](task_id=task_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    deleted = storage.delete_task(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found.")
    return {"status": "success", "message": f"Deleted task {task_id}"}

@app.get("/api/plan")
def get_daily_plan():
    plan = storage.get_plan()
    if not plan:
        # Build one automatically
        res = TOOL_REGISTRY["build_daily_plan"](available_hours=4.0)
        return res["plan"]
    return plan.model_dump()

@app.post("/api/plan/build")
def build_daily_plan(available_hours: float = Body(4.0, embed=True)):
    return TOOL_REGISTRY["build_daily_plan"](available_hours=available_hours)

@app.post("/api/rescue")
def trigger_rescue(stress_level: str = Body("high", embed=True), hours_available: float = Body(3.0, embed=True)):
    return TOOL_REGISTRY["rescue_my_day"](stress_level=stress_level, hours_available=hours_available)

# Mount frontend files if dist or static exists
if os.path.exists(os.path.join(FRONTEND_DIR, "dist")):
    app.mount("/", StaticFiles(directory=os.path.join(FRONTEND_DIR, "dist"), html=True), name="frontend")
elif os.path.exists(os.path.join(FRONTEND_DIR, "public")):
    app.mount("/", StaticFiles(directory=os.path.join(FRONTEND_DIR, "public"), html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
