import type { CostTable } from "@/lib/costs";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const show = (v: number | null) => (v === null ? "—" : number.format(v));

/** Two side-by-side tables sharing one category order: [start, end) columns on each side. */
export function CostSection({
  title,
  note,
  table,
  split,
}: {
  title: string;
  note: string;
  table: CostTable;
  /** Number of leading period columns that belong to the left (yearly) panel. */
  split: number;
}) {
  const panels = [
    { heading: "Per year", idx: table.periods.slice(0, split).map((_, i) => i) },
    {
      heading: "Running costs",
      idx: table.periods.slice(split).map((_, i) => i + split),
    },
  ];

  return (
    <section>
      <h2>{title}</h2>
      <p className="note">{note}</p>
      <div className="panels">
        {panels.map((panel) => (
          <div key={panel.heading} className="panel">
            <h3>{panel.heading}</h3>
            <table>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  {panel.idx.map((i) => (
                    <th key={table.periods[i].key} scope="col" className="num">
                      {table.periods[i].label}
                      <small>{table.periods[i].span}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="total">
                  <th scope="row">Total</th>
                  {panel.idx.map((i) => (
                    <td key={table.periods[i].key} className="num">{show(table.totals[i])}</td>
                  ))}
                </tr>
                {table.rows.map((row) => (
                  <tr key={row.category}>
                    <th scope="row">{row.category}</th>
                    {panel.idx.map((i) => (
                      <td key={table.periods[i].key} className="num">{show(row.values[i])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
