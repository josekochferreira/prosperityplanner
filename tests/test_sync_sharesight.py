import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pytest  # noqa: E402
import sync_sharesight  # noqa: E402

OWNER = "11111111-1111-1111-1111-111111111111"


class FakeStore:
    def __init__(self):
        self.tables, self.finished = {}, None

    def start_run(self, agent, owner_id, params):
        return "run1"

    def upsert(self, table, rows, conflict):
        self.tables.setdefault(table, []).extend(rows)
        return len(rows)

    def finish_run(self, run_id, **fields):
        self.finished = fields


class FakeSharesight:
    def __init__(self, fail=False):
        self.fail = fail

    def list_portfolios(self):
        return [{"id": 7, "name": "Main", "currency_code": "EUR"}]

    def get_performance(self, pid):
        if self.fail:
            raise RuntimeError("boom")
        return {"report": {"value": "1000.5", "total_gain": 50, "start_date": "2026-01-01",
                           "end_date": "2026-10-05",
                           "holdings": [{"id": 1, "instrument": {"code": "VWCE", "name": "Vanguard"},
                                         "value": 400}]}}

    def get_holdings(self, pid):
        return []


def test_sync_writes_all_tables():
    store = FakeStore()
    r = sync_sharesight.sync(FakeSharesight(), store, OWNER, today="2026-10-05")
    assert r == {"portfolios": 1, "holdings": 1}
    snap = store.tables["sharesight_snapshots"][0]
    assert snap["value"] == "1000.5" and snap["cost_base"] is None
    h = store.tables["sharesight_holdings"][0]
    assert h["symbol"] == "VWCE" and h["owner_id"] == OWNER
    assert store.finished["status"] == "succeeded"


def test_failure_is_logged():
    store = FakeStore()
    with pytest.raises(RuntimeError):
        sync_sharesight.sync(FakeSharesight(fail=True), store, OWNER)
    assert store.finished["status"] == "failed"
