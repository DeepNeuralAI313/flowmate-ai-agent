# FlowMate AI — Technical Architecture

## Overview
FlowMate AI is an agentic workday copilot engineered specifically for freelancers, consultants, and independent operators. It bridges conversational task management with explainable automated scheduling and a signature **Rescue My Day** calm recovery protocol.

---

## High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------+
|                                 USER / BROWSER                                  |
|         React 18 Single-Page Application (Tailwind CSS, Glassmorphic UI)        |
+---------------------------------------------------------------------------------+
                                       |
                 REST API Requests     | JSON Events / Chat Actions
                                       v
+---------------------------------------------------------------------------------+
|                                FASTAPI BACKEND                                  |
|   - Task & Plan Endpoints (/api/tasks, /api/plan)                               |
|   - Agent Orchestrator (/api/chat, /api/rescue)                                 |
|   - Health & AWS Diagnostics (/api/health, /api/bedrock/status)                 |
+---------------------------------------------------------------------------------+
       |                                                    |
       v                                                    v
+-------------------------------+         +---------------------------------------+
|    PERSISTENT TASK STORAGE    |         |        FLOWMATE AGENT RUNTIME         |
|   - File JSON Engine          |         |  Autonomous Loop with Tool Execution  |
|   - Optional AWS DynamoDB     |         +---------------------------------------+
+-------------------------------+                          |
                                                           v
                              +---------------------------------------------------+
                              |               AMAZON BEDROCK CONVERSE             |
                              |   Model: anthropic.claude-3-haiku-20240307-v1:0   |
                              |   Autonomous Tool Calling Protocol:               |
                              |     - add_task                                    |
                              |     - list_tasks                                  |
                              |     - update_task                                 |
                              |     - complete_task                               |
                              |     - prioritize_tasks                            |
                              |     - build_daily_plan                            |
                              |     - rescue_my_day                               |
                              |     - save_plan                                   |
                              +---------------------------------------------------+
```

---

## Core Components

### 1. Amazon Bedrock Converse Integration
- **Engine:** AWS Bedrock Runtime (`bedrock-runtime`) using the modern `Converse` API.
- **Model Choice:** `anthropic.claude-3-haiku-20240307-v1:0` (Ultra-low latency, high reasoning quality, economical token economics).
- **Tool Protocol:** Bedrock Converse Tool Use Schema where each tool call specifies `toolUseId`, parameters, and receives structured execution feedback (`toolResult`).
- **Resilience Engine:** If AWS credentials are temporarily not present in a local testing environment, an internal high-fidelity agent engine executes identical tools and logic deterministically, ensuring zero developer lock-out.

### 2. Autonomous Agent Tools
All tools are defined in `backend/tools.py` with strict Pydantic and JSONSchema validation:
1. `add_task`: Parses natural language title, priority, estimated duration, and deadline.
2. `list_tasks`: Retrieves active or completed tasks filtered by priority and status.
3. `update_task`: Adjusts deadlines, durations, or priority in-flight.
4. `complete_task`: Records completion timestamp and marks status `COMPLETED`.
5. `prioritize_tasks`: Ranks tasks based on deadline urgency, priority weight, and available working hours budget.
6. `build_daily_plan`: Generates a sequential time-blocked workday calendar with built-in 15-minute restorative buffers.
7. `rescue_my_day`: Simplifies an overwhelming backlog into a calm 3-step action plan with micro next actions.
8. `save_plan`: Persists generated plans to disk.

### 3. Frontend Architecture
- **Framework:** React 18 SPA with Tailwind CSS design tokens.
- **Visual Direction:** Curated teal (`#0d9488`), indigo (`#4f46e5`), and soft rose accents with subtle glassmorphic backdrop-blur elements.
- **State Management:** Reactive dual-layer sync (FastAPI REST backend with localStorage resilience).
- **Micro-Interactions:** Floating leaf reassurance badges, real-time tool execution chips (`🔧 add_task ✓`), and completion celebratory feedback.

---

## AWS Deployment Architecture

### Deployment Option A: AWS Amplify Hosting (Recommended for Web)
- Build static frontend assets and host via AWS Amplify Console with global CloudFront CDN distribution.
- Connect API calls to an AWS App Runner or AWS Lambda (Container) endpoint.

### Deployment Option B: AWS Lambda & API Gateway (Serverless)
- Package `backend/` using Mangum ASGI adapter for AWS Lambda.
- Zero idle costs; executes in sub-100ms cold start times.
- Bedrock permissions granted via IAM Role (`bedrock:InvokeModel`).

### Deployment Option C: AWS ECS / Fargate (Containerized)
- Package app into Docker container.
- Run on ECS Fargate behind an Application Load Balancer (ALB).
