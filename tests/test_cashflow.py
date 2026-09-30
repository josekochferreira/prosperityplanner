import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import cashflow  # noqa: E402


def txn(type_, amount, date="2026-01-15", tags=None, **kw):
    return {"type": type_, "amount": amount, "date": date, "tagNames": tags or [], **kw}


def test_income_expense_and_transfers_excluded():
    s = cashflow.summarise([
        txn("income", 5000, tags=["Salary"]),
        txn("expense", -1200.5, tags=["Rent"]),
        txn("transfer", -300),
        txn("investment purchase", -1000),
    ])
    assert s["totals"]["income"] == Decimal("5000")
    assert s["totals"]["expense"] == Decimal("1200.5")
    assert s["monthly"][0]["net"] == Decimal("3799.5")


def test_monthly_grouping_and_categories():
    s = cashflow.summarise([
        txn("expense", -10, "2026-01-31", ["Food"]),
        txn("expense", -20, "2026-02-01", ["Food"]),
        txn("expense", -5, "2026-02-02"),
    ])
    assert [m["month"] for m in s["monthly"]] == ["2026-01", "2026-02"]
    assert s["categories"]["expense"][0] == ("Food", Decimal("30"))
    assert ("Uncategorised", Decimal("5")) in s["categories"]["expense"]


def test_pending_excluded_by_default():
    t = [txn("expense", -10, isPending=True), txn("expense", -5)]
    assert cashflow.summarise(t)["totals"]["expense"] == Decimal("5")
    assert cashflow.summarise(t, include_pending=True)["totals"]["expense"] == Decimal("15")


def test_savings_rate_none_without_income():
    assert cashflow.summarise([txn("expense", -5)])["monthly"][0]["savings_rate"] is None
