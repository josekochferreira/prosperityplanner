"""Buxfer API client (email/password login -> session token)."""

import os
import requests

BASE_URL = "https://www.buxfer.com/api"
PAGE_SIZE = 100  # Buxfer returns up to 100 transactions per page


class BuxferError(RuntimeError):
    pass


class BuxferClient:
    def __init__(self, email: str, password: str):
        self._session = requests.Session()
        self._token = self._login(email, password)

    def _login(self, email: str, password: str) -> str:
        resp = self._session.post(
            f"{BASE_URL}/login",
            data={"email": email, "password": password},
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json().get("response", {})
        if body.get("status") != "OK" or "token" not in body:
            raise BuxferError(f"Buxfer login failed: {body.get('status', 'unknown')}")
        return body["token"]

    def _get(self, endpoint: str, **params) -> dict:
        resp = self._session.get(
            f"{BASE_URL}/{endpoint}",
            params={"token": self._token, **params},
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json().get("response", {})
        if body.get("status") != "OK":
            raise BuxferError(f"Buxfer {endpoint} failed: {body.get('status', 'unknown')}")
        return body

    def list_accounts(self) -> list[dict]:
        return self._get("accounts").get("accounts", [])

    def list_transactions(
        self, start_date: str | None = None, end_date: str | None = None
    ) -> list[dict]:
        """Fetch all transactions, following pagination. Dates are YYYY-MM-DD."""
        params = {}
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date

        transactions: list[dict] = []
        page = 1
        while True:
            body = self._get("transactions", page=page, **params)
            batch = body.get("transactions", [])
            transactions.extend(batch)
            total = int(body.get("numTransactions", len(transactions)))
            if not batch or len(transactions) >= total:
                return transactions
            page += 1


def from_env() -> BuxferClient:
    return BuxferClient(os.environ["BUXFER_EMAIL"], os.environ["BUXFER_PASSWORD"])
