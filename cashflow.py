"""Income vs. expense analysis over Buxfer transactions. Pure functions, no I/O."""

from collections import defaultdict
from decimal import Decimal

INCOME_TYPES = {"income", "refund"}
EXPENSE_TYPES = {"expense"}
# Everything else (transfer, investment purchase/sale, loan, settlement, ...) moves
# money between places and is excluded so it doesn't distort income/expenses.

UNCATEGORISED = "Uncategorised"


def _classify(txn: dict) -> str | None:
    kind = (txn.get("type") or "").lower()
    if kind in INCOME_TYPES:
        return "income"
    if kind in EXPENSE_TYPES:
        return "expense"
    return None


def _category(txn: dict) -> str:
    tags = txn.get("tagNames") or []
    return tags[0] if tags else UNCATEGORISED


def summarise(transactions: list[dict], include_pending: bool = False) -> dict:
    """Return monthly and per-category income/expense totals.

    Amounts are Decimals of absolute value; the sign is carried by the bucket.
    Refunds count as income here; consider netting them against expenses later.
    """
    months: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"income": Decimal(0), "expense": Decimal(0)}
    )
    categories: dict[str, dict[str, Decimal]] = {
        "income": defaultdict(Decimal),
        "expense": defaultdict(Decimal),
    }

    for txn in transactions:
        bucket = _classify(txn)
        if bucket is None:
            continue
        if not include_pending and (txn.get("isPending") or txn.get("isFutureDated")):
            continue
        amount = abs(Decimal(str(txn.get("amount", 0))))
        month = str(txn.get("date", ""))[:7]  # YYYY-MM
        if not month:
            continue
        months[month][bucket] += amount
        categories[bucket][_category(txn)] += amount

    monthly = [
        {
            "month": m,
            "income": v["income"],
            "expense": v["expense"],
            "net": v["income"] - v["expense"],
            "savings_rate": (
                (v["income"] - v["expense"]) / v["income"] if v["income"] else None
            ),
        }
        for m, v in sorted(months.items())
    ]
    total_income = sum((r["income"] for r in monthly), Decimal(0))
    total_expense = sum((r["expense"] for r in monthly), Decimal(0))
    return {
        "monthly": monthly,
        "categories": {
            k: sorted(v.items(), key=lambda kv: kv[1], reverse=True)
            for k, v in categories.items()
        },
        "totals": {
            "income": total_income,
            "expense": total_expense,
            "net": total_income - total_expense,
        },
    }
