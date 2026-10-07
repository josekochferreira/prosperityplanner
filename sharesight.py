"""Sharesight API client using client_credentials OAuth2 flow."""

from __future__ import annotations

import os
import requests

BASE_URL = "https://api.sharesight.com/api/v3"
TOKEN_URL = "https://api.sharesight.com/oauth2/token"


def _get_token(client_id: str, client_secret: str) -> str:
    resp = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


class SharesightClient:
    def __init__(self, client_id: str, client_secret: str):
        self._token = _get_token(client_id, client_secret)
        self._session = requests.Session()
        self._session.headers.update({"Authorization": f"Bearer {self._token}"})

    def _get(self, path: str, **params) -> dict:
        resp = self._session.get(f"{BASE_URL}{path}", params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def list_portfolios(self) -> list[dict]:
        return self._get("/portfolios")["portfolios"]

    def get_holdings(self, portfolio_id: int) -> list[dict]:
        data = self._get(f"/portfolios/{portfolio_id}/holdings")
        return data.get("holdings", [])

    def get_performance(self, portfolio_id: int, start_date: str | None = None,
                        end_date: str | None = None) -> dict:
        params = {k: v for k, v in
                  {"start_date": start_date, "end_date": end_date}.items() if v}
        return self._get(f"/portfolios/{portfolio_id}/performance", **params)


def from_env() -> SharesightClient:
    client_id = os.environ["SHARESIGHT_CLIENT_ID"]
    client_secret = os.environ["SHARESIGHT_CLIENT_SECRET"]
    return SharesightClient(client_id, client_secret)


if __name__ == "__main__":
    # Connection check: authenticates and lists portfolios. Never prints credentials.
    from dotenv import load_dotenv

    load_dotenv()
    for p in from_env().list_portfolios():
        print(p.get("id"), p.get("name"), p.get("currency_code") or p.get("currency"))
