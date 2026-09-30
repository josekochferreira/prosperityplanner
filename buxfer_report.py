"""Fetch Buxfer transactions and render an income vs. expenses view."""

import argparse
import html
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv

import buxfer
import cashflow
import supabase_store

load_dotenv()


def print_text(summary: dict) -> None:
    fmt = "{:<8} {:>12} {:>12} {:>12} {:>9}"
    print(fmt.format("Month", "Income", "Expenses", "Net", "Saved"))
    print("-" * 57)
    for r in summary["monthly"]:
        rate = f"{r['savings_rate']:.0%}" if r["savings_rate"] is not None else "-"
        print(fmt.format(r["month"], f"{r['income']:,.2f}", f"{r['expense']:,.2f}",
                         f"{r['net']:,.2f}", rate))
    t = summary["totals"]
    print("-" * 57)
    print(fmt.format("Total", f"{t['income']:,.2f}", f"{t['expense']:,.2f}",
                     f"{t['net']:,.2f}", ""))
    print("\nTop expense categories:")
    for name, amount in summary["categories"]["expense"][:10]:
        print(f"  {name:<30} {amount:>12,.2f}")


def render_html(summary: dict) -> str:
    rows = summary["monthly"]
    peak = max([float(r["income"]) for r in rows] + [float(r["expense"]) for r in rows] + [1])

    def bar(value, cls):
        return f'<div class="bar {cls}" style="width:{float(value) / peak * 100:.1f}%"></div>'

    body = "".join(
        f"<tr><td>{html.escape(r['month'])}</td>"
        f"<td class='chart'>{bar(r['income'], 'inc')}{bar(r['expense'], 'exp')}</td>"
        f"<td class='n'>{r['income']:,.2f}</td><td class='n'>{r['expense']:,.2f}</td>"
        f"<td class='n {'neg' if r['net'] < 0 else ''}'>{r['net']:,.2f}</td></tr>"
        for r in rows
    )
    cats = "".join(
        f"<tr><td>{html.escape(n)}</td><td class='n'>{a:,.2f}</td></tr>"
        for n, a in summary["categories"]["expense"][:15]
    )
    t = summary["totals"]
    return f"""<!doctype html><meta charset="utf-8"><title>Income &amp; Expenses</title>
<style>
body{{font:15px system-ui;max-width:900px;margin:2rem auto;padding:0 1rem;color:#222}}
table{{border-collapse:collapse;width:100%;margin-bottom:2rem}}
td,th{{padding:.35rem .5rem;border-bottom:1px solid #eee;text-align:left}}
.n{{text-align:right;font-variant-numeric:tabular-nums}} .neg{{color:#b00020}}
.chart{{width:40%}} .bar{{height:8px;margin:2px 0;border-radius:2px}}
.inc{{background:#2e7d32}} .exp{{background:#c62828}}
</style>
<h1>Income &amp; Expenses</h1>
<p>Income <b>{t['income']:,.2f}</b> · Expenses <b>{t['expense']:,.2f}</b> · Net <b>{t['net']:,.2f}</b></p>
<table><tr><th>Month</th><th>Income (green) / Expenses (red)</th><th class="n">Income</th><th class="n">Expenses</th><th class="n">Net</th></tr>{body}</table>
<h2>Top expense categories</h2><table>{cats}</table>"""


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--start", default=(date.today() - timedelta(days=365)).isoformat(),
                   help="YYYY-MM-DD (default: 12 months ago)")
    p.add_argument("--end", default=date.today().isoformat(), help="YYYY-MM-DD (default: today)")
    p.add_argument("--include-pending", action="store_true")
    p.add_argument("--from-db", action="store_true",
                   help="read transactions from Supabase instead of calling Buxfer")
    p.add_argument("--html", metavar="FILE", help="also write an HTML view to FILE")
    args = p.parse_args()

    if args.from_db:
        rows = supabase_store.from_env().select(
            "transactions", select="raw", source="eq.buxfer", order="date.asc",
            **{"and": f"(date.gte.{args.start},date.lte.{args.end})"})
        txns = [r["raw"] for r in rows]
    else:
        txns = buxfer.from_env().list_transactions(args.start, args.end)
    summary = cashflow.summarise(txns, include_pending=args.include_pending)
    print(f"{len(txns)} transactions, {args.start} to {args.end}\n")
    print_text(summary)
    if args.html:
        Path(args.html).write_text(render_html(summary), encoding="utf-8")
        print(f"\nWrote {args.html}")


if __name__ == "__main__":
    main()
