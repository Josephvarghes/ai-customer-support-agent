from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph import add_messages


def append_logs(left: list[dict] | None, right: list[dict] | None) -> list[dict]:
    """Appends reasoning telemetry logs."""
    if left is None:
        left = []
    if right is None:
        right = []
    return left + right


class AgentState(TypedDict):
    """The state of the customer support agent."""

    messages: Annotated[list[BaseMessage], add_messages]
    customer_id: str | None
    current_order_id: str | None
    policy_checks: dict
    agent_reasoning_logs: Annotated[list[dict], append_logs]
    refund_status: str | None
