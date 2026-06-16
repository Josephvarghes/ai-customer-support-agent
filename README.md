# AI Customer Support Agent (Monorepo)

A state-of-the-art, dual-panel Customer Support dashboard and automated reasoning agent. The system features a **FastAPI** backend orchestrating a **LangGraph** workflow that evaluates refund policies against customer profile records, streaming token responses and live execution telemetry to a **Vite + React + TypeScript** frontend dashboard.

---

## 🏗️ Monorepo Architecture

This workspace is structured as a decoupled monorepo containing distinct directories for the backend service, frontend dashboard, and agent tracking artifacts:

```text
AI Customer care support/
├── .agents/                    # Agent Workspace & Session State Tracking
│   ├── plan.md                 # Implementation phases and checklist
│   ├── scratchpad.md           # Live status & architectural decisions
│   └── session_logs.json       # Milestones and historical session logs
├── backend/                    # FastAPI + LangGraph Backend service
│   ├── data/                   # Business data and policy specifications
│   │   ├── crm_seed.json       # Mock customer profiles (database seed)
│   │   └── policy.md           # Refund policies and eligibility constraints
│   ├── src/                    # Python application codebase
│   │   ├── agent/              # LangGraph Agent logic
│   │   │   ├── graph.py        # Workflow graph and conditional routing definition
│   │   │   ├── nodes.py        # Executable graph nodes (LLM agent, tool executor)
│   │   │   ├── state.py        # Graph state schema definition
│   │   │   └── tools.py        # LLM tools (CRM query, policy evaluation)
│   │   ├── database.py         # Mock CRM database query & update layer
│   │   ├── policy.py           # Refund policy evaluation parser engine
│   │   └── main.py             # FastAPI App, REST endpoints & WebSocket telemetry router
│   ├── pyproject.toml          # uv backend project packaging & dependencies
│   └── uv.lock                 # uv package manager lockfile
├── frontend/                   # React + TypeScript + Tailwind CSS Frontend Client
│   ├── src/                    # React codebase
│   │   ├── assets/             # UI static assets
│   │   ├── App.tsx             # Twin-Panel Dashboard application entry point
│   │   ├── App.css             # App-specific animations and styles
│   │   └── index.css           # Tailwind design tokens and gradients
│   ├── package.json            # Node dependencies and scripts
│   └── vite.config.ts          # Vite bundling configuration
├── .pre-commit-config.yaml     # Global pre-commit linting rules (Ruff)
└── README.md                   # This project index
```

---

## 🛠️ Tech Stack & Key Features

### Backend (`backend/`)
- **FastAPI**: Serves a REST API for viewing CRM profiles and an active WebSocket endpoint for interactive support chat.
- **LangGraph**: Orchestrates the multi-agent graph containing:
  - `call_llm_agent`: Node running the main GPT model.
  - `execute_tools`: Node triggering backend tools dynamically.
  - `finalize_decision`: Terminal node finalizing state based on eligibility checklist outcome.
- **Tooling Engine**: Equipped with tools to read the CRM profiles (`lookup_customer_profile`), check order criteria (`verify_order_eligibility`), and evaluate refund requests against criteria (`validate_refund_against_policy`).
- **Telemetry Streaming**: Dispatches live execution logs (node traversal, tool calls, return payloads) using `.astream_events(version="v2")` to the client.
- **Session Checkpointing**: Uses `MemorySaver` to checkpoint and persist graph states dynamically mapped to a unique user session.

### Frontend (`frontend/`)
- **Vite + React + TypeScript**: A responsive, high-performance UI.
- **Tailwind CSS v3**: Sleek, custom dark-mode aesthetics using modern gradient backgrounds.
- **Twin-Panel Dashboard**:
  - **Left Panel (Interactive Chat)**: Supports a dedicated chat terminal, audio simulation/recording UI that streams transcribed prompts to the agent, and typing/thinking states.
  - **Right Panel (Live Reasoner Logs)**: Prints color-coded terminal readouts detailing what the agent is reasoning under the hood (e.g., Yellow for Tool initiation, Blue for DB queries, Red for Policy violations and denied paths).
  - **CRM Profile Drawer**: Visualized toggle list enabling scenario injection by copying distinct customer information directly.

### Agent Tracking (`.agents/`)
Contains localized agent execution data and logs to track the project's milestones, technical schemas, and architectural history:
- `plan.md`: Houses the phase checklist tracking completed features.
- `scratchpad.md`: Highlights the latest status, architectural choices, and notes.
- `session_logs.json`: Chronologically records the timestamps and summaries of milestones.

---

## 🚀 Setup and Installation

### 1. Prerequisites
Ensure you have the following installed on your machine:
- [uv](https://github.com/astral-sh/uv) (Modern Python package manager)
- [Node.js](https://nodejs.org/) (v18+) & `npm`

---

### 2. Backend Setup
1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and configure your environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure your credentials:
   ```env
   OPENAI_API_KEY=your-openai-api-key-here
   ```
3. Sync python dependencies and setup the virtual environment:
   ```bash
   uv sync
   ```
4. Start the backend development server:
   ```bash
   uv run uvicorn src.main:app --reload
   ```
   The API will be available at `http://localhost:8000` with documentation accessible at `http://localhost:8000/docs`.

---

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend UI dashboard will be accessible at `http://localhost:5173`.

---

## 🧩 Session Persistence & Reasoning Logs
- **Session Mapping**: The client's unique thread ID is stored via `sessionStorage` inside the browser on initial render. This prevents LangGraph checkpointer state from being lost if the user refreshes the browser page.
- **Live Diagnostics**: The right-hand telemetry logger listens to specific WebSocket event types (`token`, `reasoning`) and visually exposes LLM node execution, tool inputs, database output mappings, and final policy enforcement in real-time.

---

## 🧼 Code Quality & Linting
- **Pre-commit Hooks**: Enforces trailing-whitespace removal, end-of-file formatting, and YAML checks.
- **Ruff**: Configured for Python linting (`E`, `F`, `I`, `N`, `UP`, `B`, `C4`, `SIM`, `RUF`) and code formatting. Run:
  ```bash
  uv run ruff check .
  uv run ruff format .
  ```
- **ESLint**: React and TypeScript validation rules configuration. Run:
  ```bash
  npm run lint
  ```
