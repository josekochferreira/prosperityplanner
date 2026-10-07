import Link from "next/link";
import { buildCostTable } from "@/lib/costs";
import { buildPeriods } from "@/lib/periods";
import { fetchCosts, fetchPortfolio } from "@/lib/data";
import { money, percent } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { l12m } = buildPeriods(new Date());
  const [rows, portfolio] = await Promise.all([fetchCosts(`${Math.floor(l12m.startMi / 12)}-${String((l12m.startMi % 12) + 1).padStart(2, "0")}-01`), fetchPortfolio()]);

  const total = buildCostTable(rows, [l12m], "total", l12m);
  const average = buildCostTable(rows, [l12m], "monthlyAverage", l12m);
  const top = total.rows.slice(0, 5);
  const gainPct = portfolio && portfolio.snapshot.costBase
    ? (portfolio.snapshot.totalGain / portfolio.snapshot.costBase) * 100
    : null;

  return (
    <>
      <h1>Dashboard</h1>
      <p className="note">Key figures from each page.</p>

      <div className="kpis">
        <div className="kpi">
          <h3>Portfolio value</h3>
          <strong>{portfolio ? money(portfolio.snapshot.value, portfolio.snapshot.currency) : "—"}</strong>
          <small>{portfolio ? `${percent(gainPct)} total gain · as of ${portfolio.snapshot.date}` : "No Sharesight data yet"}</small>
        </div>
        <div className="kpi">
          <h3>Costs, last 12 months</h3>
          <strong>{money(total.totals[0])}</strong>
          <small>{l12m.span}</small>
        </div>
        <div className="kpi">
          <h3>Average monthly cost</h3>
          <strong>{money(average.totals[0])}</strong>
          <small>Last 12 months</small>
        </div>
      </div>

      <div className="cards">
        <section className="card">
          <h2><Link href="/costs">Top categories</Link></h2>
          <table>
            <tbody>
              {top.map((r) => (
                <tr key={r.category}>
                  <th scope="row">{r.category}</th>
                  <td className="num">{money(r.values[0])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2><Link href="/portfolio">Top holdings</Link></h2>
          {portfolio ? (
            <table>
              <tbody>
                {portfolio.holdings.slice(0, 5).map((h, i) => (
                  <tr key={`${h.symbol}-${i}`}>
                    <th scope="row">{h.symbol ?? h.name}</th>
                    <td className="num">{money(h.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="note">Nothing synced yet.</p>
          )}
        </section>

        <section className="card">
          <h2><Link href="/forecasting">Forecast</Link></h2>
          <p className="note">Projections will appear here once forecasting is built.</p>
        </section>
      </div>
    </>
  );
}
