from langgraph.graph import END, StateGraph

from src.agent.nodes import call_llm_agent, execute_tools, finalize_decision
from src.agent.state import AgentState

# Define workflow
workflow = StateGraph(AgentState)

# Register nodes
workflow.add_node("call_llm_agent", call_llm_agent)
workflow.add_node("execute_tools", execute_tools)
workflow.add_node("finalize_decision", finalize_decision)

# Set entry point
workflow.set_entry_point("call_llm_agent")


def route_after_agent(state: AgentState) -> str:
    """Router after LLM agent node."""
    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "execute_tools"
    return "finalize_decision"


def route_after_tools(state: AgentState) -> str:
    """Strict conditional router after tools execution."""
    policy_checks = state.get("policy_checks") or {}

    # If policy validation was executed and it flagged any violations
    if policy_checks:
        within_30_days = policy_checks.get("within_30_days", True)
        approved_category = policy_checks.get("approved_category", True)
        within_membership_limit = policy_checks.get("within_membership_limit", True)
        not_clearance = policy_checks.get("not_clearance", True)

        is_eligible = (
            within_30_days
            and approved_category
            and within_membership_limit
            and not_clearance
        )
        if not is_eligible:
            # Enforce DENIED route directly to finalize_decision
            return "finalize_decision"

    # Otherwise, return control to agent
    return "call_llm_agent"


# Define transitions
workflow.add_conditional_edges(
    "call_llm_agent",
    route_after_agent,
    {
        "execute_tools": "execute_tools",
        "finalize_decision": "finalize_decision",
    },
)

workflow.add_conditional_edges(
    "execute_tools",
    route_after_tools,
    {
        "call_llm_agent": "call_llm_agent",
        "finalize_decision": "finalize_decision",
    },
)

workflow.add_edge("finalize_decision", END)

# Compile graph
app = workflow.compile()
