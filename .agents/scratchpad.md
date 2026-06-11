# Agent Scratchpad

## Current Status
- Completed core Agent Loop, state schemas, database layer, and policy-checking tools.
- Resolved circular import issue (E402) by modularizing state definition into a clean `src/agent/state.py` file.
- Enabled Groq API support using custom base URL override with compile-safe model fallback.
- Graph successfully compiles and passes ruff validation.
- All pre-commit hooks are passing cleanly.
- Implemented real-time streaming WebSocket endpoint in `src/main.py` integrating LangGraph's `.astream_events(version="v2")`.
- Integrated `MemorySaver` in `src/agent/graph.py` to support persistent thread session states.
- Implemented `GET /api/crm/profiles` to fetch all customer profile records for dashboard visualizers.

## Architectural Decisions
1. **Thread-safe CRM Database**: Implemented a `CRMDatabase` singleton with double-checked locking using Python's `threading.Lock` to safely support concurrency.
2. **Deterministic Policy Engine**: Structured `PolicyEngine` to run static rules checking (returning structured validation check flags) preventing LLM hallucination on refund limits, window limits, and category constraints.
3. **State Schema & Reducers**:
   - `messages`: message history list.
   - `customer_id` / `current_order_id`: tracks current evaluation context.
   - `policy_checks`: stores boolean truth values of policy evaluations.
   - `agent_reasoning_logs`: custom list of dictionaries logging tool telemetry (tool, arguments, outcomes, timestamp).
4. **Deterministic Routing**: Custom routing logic `route_after_tools` intercepts execution after `execute_tools`. If any policy check is violated, it routes immediately to `finalize_decision` which forces `refund_status = "DENIED"`, preventing the LLM from overriding policies.
5. **Groq API Integration**: Configured ChatOpenAI model in `nodes.py` to prioritize `GROQ_API_KEY` on base URL `https://api.groq.com/openai/v1` for Groq access, with a compile-safe fallback when credentials are not present in test runs.
6. **Persistent Thread Checkpointing**: Updated graph compilation in `src/agent/graph.py` to utilize `MemorySaver` as a checkpointer. This allows the backend to restore state for a conversation matching a given client ID/thread ID.
7. **Real-time Event Streaming**: Used the `.astream_events(..., version="v2")` LangGraph API inside FastAPI's websocket connection. This extracts raw text tokens (from `on_chat_model_stream`) and structured reasoning messages (from tool execution and node transitions) to send immediately to the frontend.

## Notes & Discoveries
- Git branch: `feature/day3-backend-stream`
- Validation logs: `uv run python -c "from src.agent.graph import app"` executes and compiles cleanly.
- Web server startup: `uv run uvicorn src.main:app --host 127.0.0.1 --port 8000` starts cleanly.

## Next Steps
- Implement frontend UI in React to connect to `/ws/chat/{client_id}`.
- Implement comprehensive client-side telemetry charts using `GET /api/crm/profiles` and the WebSocket reasoning events.
