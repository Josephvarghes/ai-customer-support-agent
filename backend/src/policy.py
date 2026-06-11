from datetime import date, datetime
from pathlib import Path
from typing import Any

POLICY_FILE_PATH = Path(__file__).resolve().parent.parent / "data" / "policy.md"


class PolicyEngine:
    def __init__(self, policy_file: str | Path | None = None):
        if policy_file is None:
            policy_file = POLICY_FILE_PATH
        self.policy_file = Path(policy_file)
        self.policy_text = ""
        self.load_policy()

    def load_policy(self) -> None:
        if self.policy_file.exists():
            with open(self.policy_file, encoding="utf-8") as f:
                self.policy_text = f.read()

    def evaluate(
        self,
        customer_profile: dict[str, Any],
        order_details: dict[str, Any],
        current_date: date | None = None,
    ) -> dict[str, Any]:
        """Deterministically evaluates policy rules against CRM customer/order data."""
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
            days_since_purchase = (current_date - purchase_date).days
            within_30_days = days_since_purchase <= 30
        except (ValueError, TypeError):
            days_since_purchase = -1
            within_30_days = False

        # Check clearance items (e.g. price ends with .99)
        is_clearance = abs(amount % 1 - 0.99) < 0.001

        # Check condition rules by category
        item_sealed = condition == "sealed"
        approved_category = True
        if category in ("cosmetics", "apparel") and condition == "opened":
            approved_category = False

        # Calculate base refund amount
        refund_amount = amount
        applied_fees = 0.0

        # Apply restocking fee for opened electronics
        if category == "electronics" and condition == "opened":
            restocking_fee = amount * 0.15
            refund_amount = amount - restocking_fee
            applied_fees = restocking_fee

        # Check membership limits
        within_membership_limit = True
        if membership == "Standard" and amount > 200.00:
            within_membership_limit = False

        # Structural validation flags
        checks = {
            "within_30_days": within_30_days,
            "item_sealed": item_sealed,
            "approved_category": approved_category,
            "within_membership_limit": within_membership_limit,
            "not_clearance": not is_clearance,
        }

        # Evaluate final eligibility
        if days_since_purchase == -1:
            return {
                "eligible": False,
                "reason": f"Invalid purchase date format: {purchase_date_str}",
                "refund_amount": 0.0,
                "applied_fees": 0.0,
                "checks": checks,
            }

        if not within_30_days:
            return {
                "eligible": False,
                "reason": (
                    f"Purchase was {days_since_purchase} days ago, "
                    "exceeding the 30-day window."
                ),
                "refund_amount": 0.0,
                "applied_fees": 0.0,
                "checks": checks,
            }

        if is_clearance:
            return {
                "eligible": False,
                "reason": "Clearance items ending in .99 are non-refundable.",
                "refund_amount": 0.0,
                "applied_fees": 0.0,
                "checks": checks,
            }

        if not approved_category:
            return {
                "eligible": False,
                "reason": f"Opened {category} items are non-refundable.",
                "refund_amount": 0.0,
                "applied_fees": 0.0,
                "checks": checks,
            }

        if not within_membership_limit:
            return {
                "eligible": False,
                "reason": (
                    f"Refund amount of ${amount} exceeds the $200 limit "
                    "for Standard tier accounts."
                ),
                "refund_amount": 0.0,
                "applied_fees": 0.0,
                "checks": checks,
            }

        return {
            "eligible": True,
            "reason": "Request meets all policy requirements.",
            "refund_amount": round(refund_amount, 2),
            "applied_fees": round(applied_fees, 2),
            "checks": checks,
        }


def evaluate_refund_policy(
    customer_profile: dict[str, Any],
    order_details: dict[str, Any],
    current_date: date | None = None,
) -> dict[str, Any]:
    """Compatibility wrapper function."""
    engine = PolicyEngine()
    return engine.evaluate(customer_profile, order_details, current_date)
