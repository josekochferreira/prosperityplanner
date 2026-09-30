import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pytest  # noqa: E402
import sync_buxfer  # noqa: E402


class FakeStore:
    def __init__(self):
        self.tables, self.finished = {}, None

    def start_run(self, agent, params):
        return "run1"

    def upsert(self, table, rows, conflict):
        self.tables.setdefault(table, []).extend(rows)
        return len(rows)

    def finish_run(self, run_id, **fields):
        self.finished = fields


class FakeBuxfer:
    def __init__(self, fail=False):
        self.fail = fail

    def list_accounts(self):
        return [{"id": 1, "name": "Checking", "balance": 10.5}]

    def list_transactions(self, start, end):
        if self.fail:
            raise RuntimeError("boom")
        return [{"id": 7, "accountId": 1, "accountName": "Checking", "date": "2026-09-01",
                 "type": "Expense", "amount": -12.3, "tagNames": ["Food"], "isPending": False}]


def test_sync_upserts_and_logs_success():
    store = FakeStore()
    out = sync_buxfer.sync(FakeBuxfer(), store, "2026-09-01", "2026-09-30")
    assert out == {"accounts": 1, "transactions": 1}
    row = store.tables["transactions"][0]
    assert (row["source_id"], row["type"], row["amount"], row["tags"]) == ("7", "expense", "-12.3", ["Food"])
    assert store.finished["status"] == "succeeded" and store.finished["rows_upserted"] == 1


def test_sync_logs_failure_and_reraises():
    store = FakeStore()
    with pytest.raises(RuntimeError):
        sync_buxfer.sync(FakeBuxfer(fail=True), store, "a", "b")
    assert store.finished["status"] == "failed" and "boom" in store.finished["error"]
