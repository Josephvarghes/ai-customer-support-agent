import json
from pathlib import Path
from typing import Any

CRM_FILE_PATH = Path(__file__).resolve().parent.parent / "data" / "crm_seed.json"


def load_crm_data() -> list[dict[str, Any]]:
    """Loads all customer profiles from the seed CRM file."""
    if not CRM_FILE_PATH.exists():
        return []
    with open(CRM_FILE_PATH, encoding="utf-8") as f:
        return json.load(f)


def get_customer_profile(customer_id: str) -> dict[str, Any] | None:
    """Retrieves a customer profile by their unique customer ID."""
    profiles = load_crm_data()
    for profile in profiles:
        if profile.get("customer_id") == customer_id:
            return profile
    return None


def get_order_details(order_id: str) -> dict[str, Any] | None:
    """Retrieves order details from CRM across all customer profiles."""
    profiles = load_crm_data()
    for profile in profiles:
        for order in profile.get("orders", []):
            if order.get("order_id") == order_id:
                return order
    return None
