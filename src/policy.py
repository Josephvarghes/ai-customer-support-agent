from datetime import date, datetime
from typing import Any


def evaluate_refund_policy(
    customer_profile: dict[str, Any],
    order_details: dict[str, Any],
    current_date: date | None = None,
) -> dict[str, Any]:
    """Evaluates if a refund is eligible based on the policy rules."""
    if not current_date:
        current_date = date.today()

    purchase_date_str = order_details.get("purchase_date")
    amount = order_details.get("amount", 0.0)
    category = order_details.get("item_category", "")
    condition = order_details.get("item_condition", "")
    membership = customer_profile.get("membership_tier", "Standard")

    # Parse purchase date
    try:
        purchase_date = datetime.strptime(purchase_date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return {
            "eligible": False,
            "reason": f"Invalid purchase date format: {purchase_date_str}",
            "refund_amount": 0.0,
        }

    # 1. Check general 30-day window
    days_since_purchase = (current_date - purchase_date).days
    if days_since_purchase > 30:
        return {
            "eligible": False,
            "reason": (
                f"Purchase was {days_since_purchase} days ago, "
                "exceeding the 30-day window."
            ),
        }

    # 2. Check clearance items (e.g. price ends with .99)
    if abs(amount % 1 - 0.99) < 0.001:
        return {
            "eligible": False,
            "reason": "Clearance items ending in .99 are non-refundable.",
            "refund_amount": 0.0,
        }

    # 3. Check condition rules by category
    if category == "cosmetics" and condition == "opened":
        return {
            "eligible": False,
            "reason": "Opened cosmetics are non-refundable due to hygiene policies.",
            "refund_amount": 0.0,
        }
    elif category == "apparel" and condition == "opened":
        return {
            "eligible": False,
            "reason": "Opened apparel is non-refundable.",
            "refund_amount": 0.0,
        }

    # Calculate base refund amount
    refund_amount = amount

    # Apply restocking fee for opened electronics
    if category == "electronics" and condition == "opened":
        restocking_fee = amount * 0.15
        refund_amount = amount - restocking_fee

    # 4. Check membership limits
    if membership == "Standard" and amount > 200.00:
        return {
            "eligible": False,
            "reason": (
                f"Refund amount of ${amount} exceeds the $200 limit "
                "for Standard tier accounts."
            ),
            "refund_amount": 0.0,
        }

    return {
        "eligible": True,
        "reason": "Request meets all policy requirements.",
        "refund_amount": round(refund_amount, 2),
        "applied_fees": (
            round(amount - refund_amount, 2) if refund_amount < amount else 0.0
        ),
    }
