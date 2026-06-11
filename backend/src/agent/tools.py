from datetime import date, datetime

from langchain_core.tools import tool

from src.database import CRMDatabase
from src.policy import PolicyEngine


@tool
def lookup_customer_profile(user_id: str) -> dict:
    """Retrieves customer membership and order history by user_id."""
    db = CRMDatabase()
    profile = db.get_customer(user_id)
    if not profile:
        output = f"Customer profile for user_id '{user_id}' not found."
        return {
            "output": output,
            "telemetry": {
                "tool": "lookup_customer_profile",
                "arguments": {"user_id": user_id},
                "outcome": "Customer not found.",
            },
            "state_updates": {},
        }
    output = f"Customer profile found: {profile}"
    return {
        "output": output,
        "telemetry": {
            "tool": "lookup_customer_profile",
            "arguments": {"user_id": user_id},
            "outcome": (
                f"Customer found: {profile['name']} ({profile['membership_tier']})"
            ),
        },
        "state_updates": {"customer_id": user_id},
    }


@tool
def verify_order_eligibility(order_id: str, item_id: str) -> dict:
    """Verifies order details, purchase date difference, and item condition."""
    db = CRMDatabase()
    order = db.get_order(order_id)
    if not order:
        output = f"Order {order_id} not found."
        return {
            "output": output,
            "telemetry": {
                "tool": "verify_order_eligibility",
                "arguments": {"order_id": order_id, "item_id": item_id},
                "outcome": "Order not found.",
            },
            "state_updates": {},
        }

    # Calculate days since purchase relative to current time (2026-06-10)
    purchase_date_str = order.get("purchase_date")
    current_date = date(2026, 6, 10)
    try:
        purchase_date = datetime.strptime(purchase_date_str, "%Y-%m-%d").date()
        days_since_purchase = (current_date - purchase_date).days
    except (ValueError, TypeError):
        days_since_purchase = -1

    condition = order.get("item_condition", "unknown")
    category = order.get("item_category", "unknown")
    item_name = order.get("item_name", "unknown")

    output = (
        f"Order {order_id} found. Purchased: {purchase_date_str} "
        f"({days_since_purchase} days ago). Item: {item_name}, "
        f"Category: {category}, Condition: {condition}."
    )

    return {
        "output": output,
        "telemetry": {
            "tool": "verify_order_eligibility",
            "arguments": {"order_id": order_id, "item_id": item_id},
            "outcome": (
                f"Order found. Condition: {condition}, Days: {days_since_purchase}."
            ),
        },
        "state_updates": {"current_order_id": order_id},
    }


@tool
def validate_refund_against_policy(order_id: str) -> dict:
    """Evaluates refund rules structurally against current customer order details."""
    db = CRMDatabase()
    order = db.get_order(order_id)
    if not order:
        output = f"Order {order_id} not found."
        return {
            "output": output,
            "telemetry": {
                "tool": "validate_refund_against_policy",
                "arguments": {"order_id": order_id},
                "outcome": "Order not found for policy validation.",
            },
            "state_updates": {"policy_checks": {}},
        }

    # Find the customer profile belonging to this order
    customer_profile = None
    for profile in db._data:
        if any(o.get("order_id") == order_id for o in profile.get("orders", [])):
            customer_profile = profile
            break

    if not customer_profile:
        output = f"Customer profile not found for order {order_id}."
        return {
            "output": output,
            "telemetry": {
                "tool": "validate_refund_against_policy",
                "arguments": {"order_id": order_id},
                "outcome": "Customer profile not found for order.",
            },
            "state_updates": {},
        }

    engine = PolicyEngine()
    current_date = date(2026, 6, 10)
    result = engine.evaluate(customer_profile, order, current_date=current_date)

    output = (
        f"Policy Evaluation Result: Eligible={result['eligible']}. "
        f"Reason: {result['reason']}. Refund Amount: ${result['refund_amount']}. "
        f"Applied Fees: ${result['applied_fees']}."
    )

    return {
        "output": output,
        "telemetry": {
            "tool": "validate_refund_against_policy",
            "arguments": {"order_id": order_id},
            "outcome": (
                f"Evaluation complete. Eligible: {result['eligible']}. "
                f"Reason: {result['reason']}"
            ),
        },
        "state_updates": {
            "policy_checks": result["checks"],
            "_temp_eligible": result["eligible"],
        },
    }
