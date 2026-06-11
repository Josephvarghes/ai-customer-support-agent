# Agent Scratchpad

## Current Status
- Completed core Agent Loop, state schemas, database layer, and policy-checking tools.
- Resolved circular import issue (E402) by modularizing state definition into a clean `src/agent/state.py` file.
- Enabled Grok API support using custom base URL override with compile-safe model fallback.
- Graph successfully compiles and passes ruff validation.
- All pre-commit hooks are passing cleanly.

## Architectural Decisions
1. **Thread-safe CRM Database**: Implemented a `CRMDatabase` singleton with double-checked locking using Python's `threading.Lock` to safely support concurrency.
2. **Deterministic Policy Engine**: Structured `PolicyEngine` to run static rules checking (returning structured validation check flags) preventing LLM hallucination on refund limits, window limits, and category constraints.
3. **State Schema & Reducers**:
   - `messages`: message history list.
   - `customer_id` / `current_order_id`: tracks current evaluation context.
   - `policy_checks`: stores boolean truth values of policy evaluations.
   - `agent_reasoning_logs`: custom list of dictionaries logging tool telemetry (tool, arguments, outcomes, timestamp).
4. **Deterministic Routing**: Custom routing logic `route_after_tools` intercepts execution after `execute_tools`. If any policy check is violated, it routes immediately to `finalize_decision` which forces `refund_status = "DENIED"`, preventing the LLM from overriding policies.
5. **Grok API Integration**: Configured ChatOpenAI model in `nodes.py` to prioritize `GROK_API_KEY` on base URL `https://api.x.ai/v1` for Grok access, with a compile-safe fallback when credentials are not present in test runs.

## Notes & Discoveries
- Git branch: `feature/day2-agent-core`
- Validation logs: `uv run python -c "from src.agent.graph import app"` executes and compiles cleanly.

## Next Steps
- Implement REST API endpoints in `src/main.py`.
- Integrate the compiled graph `app` into the FastAPI endpoints to run user sessions.
