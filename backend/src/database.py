import json
import threading
from pathlib import Path
from typing import Any

CRM_FILE_PATH = Path(__file__).resolve().parent.parent / "data" / "crm_seed.json"


class CRMDatabase:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, seed_file: str | Path | None = None):
        if getattr(self, "_initialized", False):
            return
        with self._lock:
            if getattr(self, "_initialized", False):
                return
            if seed_file is None:
                seed_file = CRM_FILE_PATH
            self.seed_file = Path(seed_file)
            self._data: list[dict[str, Any]] = []
            self.load_data()
            self._initialized = True

    def load_data(self) -> None:
        if self.seed_file.exists():
            with open(self.seed_file, encoding="utf-8") as f:
                self._data = json.load(f)
        else:
            self._data = []

    def get_customer(self, user_id: str) -> dict[str, Any] | None:
        """Query a customer profile by customer_id or user_id."""
        with self._lock:
            for customer in self._data:
                if (
                    customer.get("customer_id") == user_id
                    or customer.get("user_id") == user_id
                ):
                    return customer
            return None

    def get_order(self, order_id: str) -> dict[str, Any] | None:
        """Query an order profile across all customers by order_id."""
        with self._lock:
            for customer in self._data:
                for order in customer.get("orders", []):
                    if order.get("order_id") == order_id:
                        return order
            return None


# Backwards compatibility helper functions
def get_customer_profile(customer_id: str) -> dict[str, Any] | None:
    return CRMDatabase().get_customer(customer_id)


def get_order_details(order_id: str) -> dict[str, Any] | None:
    return CRMDatabase().get_order(order_id)
