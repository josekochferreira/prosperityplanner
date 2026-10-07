"""Sharesight agent: snapshot portfolios, performance and holdings into Supabase."""

from __future__ import annotations

import argparse
from datetime import date

from dotenv import load_dotenv

import sharesight
import supabase_store

load_dotenv()
AGENT = "sharesight_sync"

# Candidate key names, first match wins (Sharesight V3 is beta; verify against a live response).
HEADLINE = {
    "value": ("value", "market_value", "total_value"),
    "cost_base": ("cost_base", "cost", "total_cost"),
    "capital_gain": ("capital_gain",),
    "payout_gain": ("payout_gain", "dividend_gain", "income_gain"),
    "currency_gain": ("currency_gain",),
    "total_gain": ("total_gain",),
    "total_gain_percent": ("total_gain_percent", "total_return_percent", "total_gain_pct"),
}
HOLDING = {
    "symbol": ("symbol", "code", "instrument_code"),
    "name": ("name", "instrument_name"),
    "value": ("value", "market_value"),
    "total_gain": ("total_gain",),
    "total_gain_percent": ("total_gain_percent", "total_return_percent"),
}


def _pick(d: dict, names: tuple[str, ...]):
    for n in names:
        if d.get(n) not in (None, ""):
            return d[n]
    return None


def _extract(d: dict, mapping: dict) -> dict:
    out = {}
    for col, names in mapping.items():
        v = _pick(d, names)
        out[col] = str(v) if v is not None and col not in ("symbol", "name") else v
    return out


def portfolio_row(p: dict, owner_id: str) -> dict:
    return {
        "owner_id": owner_id,
        "source_id": str(p["id"]),
        "name": p.get("name", ""),
        "currency": p.get("currency_code") or p.get("currency"),
        "raw": p,
    }


def snapshot_row(pid: str, perf: dict, owner_id: str, today: str) -> dict:
    # Totals may sit at the top level or under "report"; check both.
    body = perf.get("report", perf)
    return {
        "owner_id": owner_id,
        "portfolio_source_id": pid,
        "snapshot_date": today,
        "period_start": body.get("start_date") or perf.get("start_date"),
        "period_end": body.get("end_date") or perf.get("end_date"),
        **_extract(body, HEADLINE),
        "raw": perf,
    }


def holding_row(pid: str, h: dict, owner_id: str, today: str) -> dict:
    inst = h.get("instrument") if isinstance(h.get("instrument"), dict) else {}
    return {
        "owner_id": owner_id,
        "portfolio_source_id": pid,
        "snapshot_date": today,
        "source_id": str(h.get("id") or h.get("holding_id") or _pick({**inst, **h}, HOLDING["symbol"])),
        **_extract({**inst, **h}, HOLDING),
        "raw": h,
    }


def sync(client, store, owner_id: str, portfolio_id: str | None = None,
         today: str | None = None) -> dict:
    today = today or date.today().isoformat()
    run_id = store.start_run(AGENT, owner_id, {"portfolio_id": portfolio_id, "date": today})
    fetched = upserted = 0
    try:
        portfolios = client.list_portfolios()
        if portfolio_id:
            portfolios = [p for p in portfolios if str(p["id"]) == str(portfolio_id)]
        store.upsert("sharesight_portfolios", [portfolio_row(p, owner_id) for p in portfolios],
                     "owner_id,source_id")
        n_holdings = 0
        for p in portfolios:  # sequential: performance reports allow 3 concurrent requests
            pid = str(p["id"])
            perf = client.get_performance(p["id"])
            body = perf.get("report", perf)
            holdings = body.get("holdings") or client.get_holdings(p["id"])
            rows = [holding_row(pid, h, owner_id, today) for h in holdings]
            store.upsert("sharesight_snapshots", [snapshot_row(pid, perf, owner_id, today)],
                         "owner_id,portfolio_source_id,snapshot_date")
            upserted += store.upsert(
                "sharesight_holdings", rows,
                "owner_id,portfolio_source_id,snapshot_date,source_id")
            fetched += len(holdings)
            n_holdings += len(holdings)
    except Exception as exc:
        store.finish_run(run_id, status="failed", error=str(exc)[:1000])
        raise
    store.finish_run(run_id, status="succeeded", rows_fetched=fetched, rows_upserted=upserted)
    return {"portfolios": len(portfolios), "holdings": n_holdings}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--portfolio", default=None, help="Portfolio id (default: all)")
    args = p.parse_args()
    import os
    pid = args.portfolio or os.environ.get("SHARESIGHT_PORTFOLIO_ID") or None
    r = sync(sharesight.from_env(), supabase_store.from_env(),
             supabase_store.owner_id_from_env(), pid)
    print(f"Synced {r['portfolios']} portfolios, {r['holdings']} holdings")


if __name__ == "__main__":
    main()
