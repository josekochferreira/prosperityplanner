"""Minimal Supabase (PostgREST) client. Uses the service-role key: server-side only."""

import os
from datetime import datetime, timezone

import requests

BATCH = 500


class SupabaseStore:
    def __init__(self, url: str, service_key: str):
        self._base = url.rstrip("/") + "/rest/v1"
        self._session = requests.Session()
        self._session.headers.update(
            {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
        )

    def _check(self, resp: requests.Response) -> requests.Response:
        if not resp.ok:
            raise RuntimeError(f"Supabase {resp.status_code}: {resp.text[:300]}")
        return resp

    def upsert(self, table: str, rows: list[dict], conflict: str) -> int:
        for i in range(0, len(rows), BATCH):
            self._check(self._session.post(
                f"{self._base}/{table}",
                params={"on_conflict": conflict},
                json=rows[i:i + BATCH],
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                timeout=60,
            ))
        return len(rows)

    def select(self, table: str, **params) -> list[dict]:
        """Read all rows (follows range pagination). params are PostgREST filters."""
        out: list[dict] = []
        while True:
            resp = self._check(self._session.get(
                f"{self._base}/{table}",
                params=params,
                headers={"Range-Unit": "items", "Range": f"{len(out)}-{len(out) + 999}"},
                timeout=60,
            ))
            batch = resp.json()
            out.extend(batch)
            if len(batch) < 1000:
                return out

    def start_run(self, agent: str, owner_id: str, params: dict) -> str:
        resp = self._check(self._session.post(
            f"{self._base}/agent_runs",
            json={"agent": agent, "owner_id": owner_id, "params": params},
            headers={"Prefer": "return=representation"},
            timeout=30,
        ))
        return resp.json()[0]["id"]

    def finish_run(self, run_id: str, **fields) -> None:
        fields["finished_at"] = datetime.now(timezone.utc).isoformat()
        self._check(self._session.patch(
            f"{self._base}/agent_runs", params={"id": f"eq.{run_id}"},
            json=fields, timeout=30,
        ))


def owner_id_from_env() -> str:
    """The Supabase Auth user id (uuid) that all ingested rows belong to."""
    return os.environ["OWNER_ID"]


def from_env() -> SupabaseStore:
    return SupabaseStore(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
