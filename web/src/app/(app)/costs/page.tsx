import { CostSection } from "@/components/CostTables";
import { buildCostTable } from "@/lib/costs";
import { buildPeriods, earliestDate } from "@/lib/periods";
import { fetchCosts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Costs() {
  const { years, l12m, ytd } = buildPeriods(new Date());
  const periods = [...years, l12m, ytd];
  const rows = await fetchCosts(earliestDate(periods));

  const total = buildCostTable(rows, periods, "total", l12m);
  const average = buildCostTable(rows, periods, "monthlyAverage", l12m);

  return (
    <>
      <h1>Costs</h1>
      <p className="note">
        Expenses only (transfers and investments excluded), grouped by top-level category and sorted by
        the last 12 months, largest first. Figures use completed months, so the current month is left
        out until it ends.
      </p>
      <CostSection
        title="Total costs"
        note="Sum of expenses in each period."
        table={total}
        split={years.length}
      />
      <CostSection
        title="Average monthly costs"
        note="Total for the period divided by its number of months."
        table={average}
        split={years.length}
      />
    </>
  );
}
