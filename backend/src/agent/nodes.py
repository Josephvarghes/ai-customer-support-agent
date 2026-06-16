import os
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI

from src.agent.state import AgentState
from src.agent.tools import (
    lookup_customer_profile,
    validate_refund_against_policy,
    verify_order_eligibility,
)

# Load environment variables relative to this file's root directory
dotenv_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=dotenv_path, override=True)

groq_api_key = os.getenv("GROQ_API_KEY")

if not groq_api_key:
    raise ValueError(
        "GROQ_API_KEY is missing or empty. Please ensure your .env file "
        "contains 'GROQ_API_KEY=your_key' and is saved to disk."
    )

llm = ChatOpenAI(
    model="llama-3.3-70b-versatile",
    openai_api_key=groq_api_key,
    openai_api_base="https://api.groq.com/openai/v1",
    temperature=0,
)

tools = [
    lookup_customer_profile,
    verify_order_eligibility,
    validate_refund_against_policy,
]
llm_with_tools = llm.bind_tools(tools)


def call_llm_agent(state: AgentState) -> dict[str, Any]:
    """Processes message history to choose a tool or generate a reply."""
    messages = state["messages"]

    system_prompt = (
        "You are an AI Customer Support Agent specializing in "
        "refund policy evaluations.\n"
        "You have access to a database and refund policy validation tool.\n"
        "Follow these instructions step-by-step:\n"
        "1. Use `lookup_customer_profile` to check the customer profile.\n"
        "2. Use `verify_order_eligibility` to check the purchase date "
        "and condition.\n"
        "3. You MUST run `validate_refund_against_policy` to run structural "
        "policy verification before making any decision.\n"
        "Do NOT make refund decisions yourself. Always run the validation tool. "
        "If the policy engine flags any violations (e.g. exceeds 30 days, "
        "opened apparel/cosmetics, clearance items, standard tier limit), "
        "you must inform the customer that their refund request is denied "
        "and explain why.\n"
        "Always guide the customer politely and concisely."
    )

    # If there is no system message in conversation history, insert one
    if not any(isinstance(msg, SystemMessage) for msg in messages):
        messages = [SystemMessage(content=system_prompt), *messages]

    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


def execute_tools(state: AgentState) -> dict[str, Any]:
    """A custom tool node that intercepts tool returns and updates state fields."""
    last_message = state["messages"][-1]
    tool_calls = getattr(last_message, "tool_calls", [])

    new_messages = []
    reasoning_logs = []
    policy_checks = {}
    customer_id = state.get("customer_id")
    current_order_id = state.get("current_order_id")

    # Map tool name to function
    tool_map = {
        "lookup_customer_profile": lookup_customer_profile,
        "verify_order_eligibility": verify_order_eligibility,
        "validate_refund_against_policy": validate_refund_against_policy,
    }

    for tool_call in tool_calls:
        name = tool_call["name"]
        args = tool_call["args"]
        call_id = tool_call["id"]

        if name in tool_map:
            tool_func = tool_map[name]
            # Invoke tool
            res = tool_func.invoke(args)

            # Extract return values
            output = res["output"]
            telemetry = res["telemetry"]
            state_updates = res["state_updates"]

            # Add timestamp to telemetry
            telemetry["timestamp"] = datetime.now().isoformat()
            reasoning_logs.append(telemetry)

            # Track context updates
            if "customer_id" in state_updates:
                customer_id = state_updates["customer_id"]
            if "current_order_id" in state_updates:
                current_order_id = state_updates["current_order_id"]
            if "policy_checks" in state_updates:
                policy_checks.update(state_updates["policy_checks"])

            new_messages.append(
                ToolMessage(content=output, name=name, tool_call_id=call_id)
            )
        else:
            new_messages.append(
                ToolMessage(
                    content=f"Error: Tool '{name}' not found.",
                    name=name,
                    tool_call_id=call_id,
                )
            )

    return {
        "messages": new_messages,
        "customer_id": customer_id,
        "current_order_id": current_order_id,
        "policy_checks": policy_checks,
        "agent_reasoning_logs": reasoning_logs,
    }


def finalize_decision(state: AgentState) -> dict[str, Any]:
    """Sets final refund_status based on structural validation."""
    policy_checks = state.get("policy_checks") or {}

    # If no policy validation was performed, default to REFERRED_TO_HUMAN
    if not policy_checks:
        return {"refund_status": "REFERRED_TO_HUMAN"}

    # Check if all criteria are satisfied
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

    if is_eligible:
        return {"refund_status": "APPROVED"}
    else:
        return {"refund_status": "DENIED"}
