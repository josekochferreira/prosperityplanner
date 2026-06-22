"""Fetch and display portfolio positions from Sharesight."""

import os
from dotenv import load_dotenv
import sharesight

load_dotenv()


def print_holdings(holdings: list[dict]) -> None:
    if not holdings:
        print("  (no holdings)")
        return
    fmt = "{:<8} {:<40} {:>10} {:>14} {:>12}"
    print(fmt.format("Symbol", "Name", "Quantity", "Market Value", "Gain/Loss %"))
    print("-" * 90)
    for h in holdings:
        symbol = h.get("symbol") or h.get("code") or "-"
        name = (h.get("instrument", {}) or {}).get("name") or h.get("description") or "-"
        qty = h.get("quantity", 0)
        value = h.get("market_value") or 0
        pct = h.get("percentage_gain_loss") or 0
        print(fmt.format(symbol[:8], name[:40], f"{qty:,.2f}", f"{value:,.2f}", f"{pct:.2f}%"))


def main() -> None:
    client = sharesight.from_env()

    portfolio_id = os.environ.get("SHARESIGHT_PORTFOLIO_ID")

    portfolios = client.list_portfolios()
    if not portfolios:
        print("No portfolios found.")
        return

    targets = (
        [p for p in portfolios if str(p["id"]) == portfolio_id]
        if portfolio_id
        else portfolios
    )

    for portfolio in targets:
        print(f"\nPortfolio: {portfolio['name']} (id={portfolio['id']})")
        holdings = client.get_holdings(portfolio["id"])
        print_holdings(holdings)


if __name__ == "__main__":
    main()
