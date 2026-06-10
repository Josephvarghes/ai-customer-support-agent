from collections.abc import Sequence
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, add_messages


class AgentState(TypedDict):
    """The state of the customer support agent."""

    messages: Annotated[Sequence[BaseMessage], add_messages]
    customer_id: str | None
    order_id: str | None
    refund_status: dict | None


# Build initial state graph skeleton
workflow = StateGraph(AgentState)

# Nodes and Edges will be defined and connected here
# compile() can be called to get the executable graph
