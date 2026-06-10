# AI Customer Support Agent

A modern backend application built with **FastAPI** and **LangGraph** designed to automate customer support workflows, specifically evaluating refund policies against mock CRM data.

## Features

- **uv**: Fast python package management.
- **Ruff**: Modern linter and formatter.
- **Pre-commit**: Automatic code quality checks before commits.
- **FastAPI**: REST API endpoints for agent interaction.
- **LangGraph**: Orchestrates agent states and tool executions.

## Directory Structure

```
├── .agents/
│   ├── scratchpad.md       # Session status and notes
│   ├── plan.md             # Execution plan
│   └── session_logs.json   # Session logs
├── data/
│   ├── crm_seed.json       # Mock customer CRM profiles
│   └── policy.md           # Refund policy constraints
├── src/
│   ├── __init__.py
│   ├── main.py             # FastAPI App initialization stub
│   ├── database.py         # Mock CRM data connection layer
│   ├── policy.py           # Evaluation logic skeleton
│   └── agent/
│       ├── __init__.py
│       ├── graph.py        # LangGraph state & routing engine stub
│       ├── nodes.py        # Graph nodes
│       └── tools.py        # CRM/Policy execution tools
├── .env.example            # Example configuration
├── .gitignore              # Ignored files
├── .pre-commit-config.yaml # Pre-commit hook configuration
├── pyproject.toml          # Project metadata and dependencies
└── README.md               # Project overview
```

## Setup & Running

1. **Prerequisites**: Ensure you have `uv` installed.
2. **Install dependencies and setup environment**:
   ```bash
   uv sync
   ```
3. **Install Pre-commit hooks**:
   ```bash
   uv run pre-commit install
   ```
4. **Run development server**:
   ```bash
   uv run uvicorn src.main:app --reload
   ```
