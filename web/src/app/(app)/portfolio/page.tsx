import { fetchPortfolio } from "@/lib/data";
import { money, percent } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function Portfolio() {
  const portfolio = await fetchPortfolio();
  if (!portfolio) {
    return (
      <>
        <h1>Portfolio</h1>
        <p className="note">No Sharesight data yet. It appears here after the first sync.</p>
      </>
    );
  }
  const { snapshot, holdings } = portfolio;
  const cur = snapshot.currency;

  return (
    <>
      <h1>Portfolio</h1>
      <p className="note">Holdings as of {snapshot.date}, from Sharesight.</p>

      <div className="kpis">
        <div className="kpi"><h3>Value</h3><strong>{money(snapshot.value, cur)}</strong></div>
        <div className="kpi"><h3>Cost base</h3><strong>{money(snapshot.costBase, cur)}</strong></div>
        <div className="kpi"><h3>Total gain</h3><strong>{money(snapshot.totalGain, cur)}</strong></div>
      </div>

      <section>
        <h2>Holdings</h2>
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th scope="col">Holding</th>
                <th scope="col" className="num">Value</th>
                <th scope="col" className="num">Weight</th>
                <th scope="col" className="num">Gain</th>
                <th scope="col" className="num">Gain %</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => (
                <tr key={`${h.symbol}-${i}`}>
                  <th scope="row">{h.symbol ?? h.name}{h.symbol && h.name ? <small className="sub"> {h.name}</small> : null}</th>
                  <td className="num">{money(h.value)}</td>
                  <td className="num">{snapshot.value ? `${((h.value / snapshot.value) * 100).toFixed(1)}%` : "—"}</td>
                  <td className="num">{money(h.totalGain)}</td>
                  <td className="num">{percent(h.totalGainPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
