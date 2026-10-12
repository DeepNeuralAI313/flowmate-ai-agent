# FlowMate AI — Your Friendly Workday Copilot ⚡🌿

> **An intelligent, empathetic AI agent built with Amazon Bedrock that helps freelancers and independent professionals manage workloads without feeling overwhelmed.**
>
> *Official entry for the AWS Builder Center Weekend Challenge: "Build an agent people actually enjoy using".*

---

## 🎯 Problem Statement & Audience
Freelancers, solo consultants, and independent developers juggle client deadlines, meetings, proposals, and administrative chores across disjointed apps. Traditional project management tools are rigid, cold, and demanding—they display guilt-inducing backlogs that amplify stress. 

**FlowMate AI** is designed for the independent worker who wants a thoughtful partner, not another demanding taskmaster. Instead of an overwhelming wall of tasks, FlowMate acts as a calm, intelligent copilot that:
- Ingests natural-language to-do braindumps and extracts structured tasks, durations, and priorities.
- Fits work realistically into your actual available hours with built-in breather buffers.
- Features **Rescue My Day**: a signature calming protocol that condenses chaotic days into 3 manageable micro-actions.

---

## ✨ Main Features

| Feature | Description |
| :--- | :--- |
| **Natural-Language Task Intake** | Tell FlowMate: *"I have a client website deadline tomorrow, two invoices to send, a meeting at 3 PM, and four hours to work today."* It extracts tasks, deadlines, durations, and categories automatically. |
| **Intelligent Task Prioritization** | Ranks tasks using an explainable algorithm weighing urgency, impact, and your available focus time. |
| **The Delightful Detail: Rescue My Day** | When feeling overwhelmed, FlowMate cuts through the noise and delivers a calm, 3-step action plan featuring: *What to do*, *Why it matters*, *Estimated time*, and a *Simple micro-action*. |
| **8 Real Autonomous Agent Tools** | Real tool calling: `add_task`, `list_tasks`, `update_task`, `complete_task`, `prioritize_tasks`, `build_daily_plan`, `rescue_my_day`, `save_plan`. |
| **Friendly First-Run Onboarding** | Welcome banner with 3 instant starter scenarios so users get value in under 10 seconds without complicated setup. |
| **Time-Blocked Calendar View** | Realistic schedule blocks with restorative 15-minute buffers so you never feel rushed. |
| **Persistence & State Sync** | Persists your workload to disk JSON with automatic localStorage fallback on refreshes. |
| **Graceful Error Handling** | Never exposes stack traces; provides clear friendly recovery advice and retry controls. |

---

## 🏗️ Technical Architecture & AWS Services

- **AI Model & Reasoning:** Amazon Bedrock (`anthropic.claude-3-haiku-20240307-v1:0`) via Bedrock Converse API with tool use schemas.
- **Backend:** Python FastAPI, Pydantic v2, Boto3.
- **Frontend:** React 18 SPA, Tailwind CSS, Plus Jakarta Sans typography, Lucide iconography.
- **Local Resilience:** Built-in Strands-style deterministic reasoning engine executing real tools when testing locally without AWS credentials.

```
[User Browser: React 18 SPA]
           |
       REST API
           v
[FastAPI Backend: Python 3.14]
     |                 |
     v                 v
[Task Storage]   [FlowMate Agent Engine]
                       |
               Bedrock Converse API
                       v
         [Amazon Bedrock: Claude 3 Haiku]
         Tools: add_task, rescue_my_day...
```

---

## 🚀 Quickstart & Installation

### 1. Prerequisites
- Python 3.10+
- Modern Web Browser (Chrome, Brave, Edge, Firefox)

### 2. Clone and Setup
```bash
git clone https://github.com/saifmodan2006/flowmate-ai-agent.git
cd flowmate-ai-agent

# Install Python backend dependencies
python -m pip install -r backend/requirements.txt
```

### 3. Environment Configuration (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
To enable live Amazon Bedrock API calls, configure your AWS credentials in `.env`:
```ini
AWS_DEFAULT_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```
*(If credentials are omitted, FlowMate automatically runs the local intelligent agent engine with real tool execution).*

### 4. Run the Application
```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Open your browser to: **`http://127.0.0.1:8000`**

---

## 🧪 Automated Testing
Run the comprehensive test suite validating all 8 tools, natural-language intake, prioritization, and Rescue My Day:
```bash
python -m pytest backend/tests/test_flowmate.py -v
```
**Test Results:**
```
backend/tests/test_flowmate.py::test_add_and_list_tasks PASSED           [ 14%]
backend/tests/test_flowmate.py::test_complete_task PASSED                [ 28%]
backend/tests/test_flowmate.py::test_prioritization_algorithm PASSED     [ 42%]
backend/tests/test_flowmate.py::test_build_daily_plan PASSED             [ 57%]
backend/tests/test_flowmate.py::test_rescue_my_day PASSED                [ 71%]
backend/tests/test_flowmate.py::test_agent_intake_reasoning PASSED       [ 85%]
backend/tests/test_flowmate.py::test_agent_rescue_reasoning PASSED       [100%]
7 passed in 3.31s
```

---

## 📸 Screenshots & Demo Walkthrough

### 1. Workday Dashboard Overview
Clean SaaS aesthetic, progress metric rings, urgent task alerts, and personalized focus indicators.

### 2. Conversational Agent with Real Tool Execution
Submitting natural language: *"I have a client website deadline tomorrow, two invoices to send, a meeting at 3 PM, and four hours to work today."*  
FlowMate autonomously executes `add_task` and `build_daily_plan` with live tool execution badges.

### 3. Signature Delight: Rescue My Day
Triggered when the user is overwhelmed. Produces a 3-step calm action plan with actionable micro-actions and non-patronizing encouragement.

### 4. Time-Blocked Workday Plan
Interactive focus hour slider with 15-minute restorative transition buffers.

---

## 📄 License
MIT License. Created for the AWS Builder Center Weekend Agent Challenge (#agents).
