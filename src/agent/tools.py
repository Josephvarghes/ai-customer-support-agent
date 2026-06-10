from langchain_core.tools import tool

from src.database import get_customer_profile, get_order_details
from src.policy import evaluate_refund_policy


@tool
def fetch_customer_profile(customer_id: str) -> str:
    """Retrieves the customer's membership tier and order history by ID."""
    profile = get_customer_profile(customer_id)
    if not profile:
        return f"Customer {customer_id} not found in CRM."
    return str(profile)


@tool
def check_order_refund_eligibility(customer_id: str, order_id: str) -> str:
    """Validates the policy constraints against a specific order refund request."""
    profile = get_customer_profile(customer_id)
    if not profile:
        return f"Customer {customer_id} not found."
    order = get_order_details(order_id)
    if not order:
        return f"Order {order_id} not found."

    # Validate that order belongs to this customer
    customer_orders = [o.get("order_id") for o in profile.get("orders", [])]
    if order_id not in customer_orders:
        return f"Order {order_id} does not belong to customer {customer_id}."

    result = evaluate_refund_policy(profile, order)
    return str(result)
