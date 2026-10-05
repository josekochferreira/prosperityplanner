"""Buxfer agent: pull accounts + transactions into Supabase, logging the run."""

import argparse
from datetime import date, timedelta

from dotenv import load_dotenv

import buxfer
import supabase_store

load_dotenv()
AGENT = "buxfer_sync"


def _tags(txn: dict) -> list[str]:
    return [t for t in (txn.get("tagNames") or []) if t]


def transaction_row(t: dict, owner_id: str) -> dict:
    return {
        "owner_id": owner_id,
        "source": "buxfer",
        "source_id": str(t["id"]),
        "account_source_id": str(t["accountId"]) if t.get("accountId") is not None else None,
        "account_name": t.get("accountName"),
        "date": str(t["date"])[:10],
        "description": t.get("description"),
        "type": (t.get("type") or "").lower(),
        "amount": str(t.get("amount", 0)),
        "tags": _tags(t),
        "is_pending": bool(t.get("isPending") or t.get("isFutureDated")),
        "raw": t,
    }


def account_row(a: dict, owner_id: str) -> dict:
    return {
        "owner_id": owner_id,
        "source": "buxfer",
        "source_id": str(a["id"]),
        "name": a.get("name", ""),
        "bank": a.get("bank"),
        "currency": a.get("currency"),
        "balance": str(a["balance"]) if a.get("balance") is not None else None,
        "raw": a,
    }


def tag_row(t: dict, owner_id: str) -> dict:
    parent = t.get("parentId")
    return {
        "owner_id": owner_id,
        "source": "buxfer",
        "source_id": str(t["id"]),
        "name": t.get("name", ""),
        "parent_source_id": str(parent) if parent not in (None, "", 0, "0") else None,
        "raw": t,
    }


def sync(client, store, owner_id: str, start: str, end: str) -> dict:
    run_id = store.start_run(AGENT, owner_id, {"start": start, "end": end})
    try:
        accounts = client.list_accounts()
        tags = client.list_tags()
        txns = client.list_transactions(start, end)
        store.upsert("accounts", [account_row(a, owner_id) for a in accounts],
                     "owner_id,source,source_id")
        store.upsert("tags", [tag_row(t, owner_id) for t in tags],
                     "owner_id,source,source_id")
        n = store.upsert("transactions", [transaction_row(t, owner_id) for t in txns],
                        "owner_id,source,source_id")
    except Exception as exc:
        store.finish_run(run_id, status="failed", error=str(exc)[:1000])
        raise
    store.finish_run(run_id, status="succeeded", rows_fetched=len(txns), rows_upserted=n)
    return {"accounts": len(accounts), "transactions": n}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--start", default=(date.today() - timedelta(days=90)).isoformat(),
                   help="YYYY-MM-DD (default: 90 days ago; use an early date for first backfill)")
    p.add_argument("--end", default=date.today().isoformat())
    args = p.parse_args()
    result = sync(buxfer.from_env(), supabase_store.from_env(),
                  supabase_store.owner_id_from_env(), args.start, args.end)
    print(f"Synced {result['accounts']} accounts, {result['transactions']} transactions")


if __name__ == "__main__":
    main()
