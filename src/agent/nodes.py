from typing import Any

from src.agent.graph import AgentState


def lookup_customer(state: AgentState) -> dict[str, Any]:
    """Node for checking customer profile in CRM."""
    # Placeholder node logic
    return {}


def evaluate_policy(state: AgentState) -> dict[str, Any]:
    """Node for evaluating refund request eligibility."""
    # Placeholder node logic
    return {}


def generate_response(state: AgentState) -> dict[str, Any]:
    """Node for drafting the response back to the customer."""
    # Placeholder node logic
    return {}
