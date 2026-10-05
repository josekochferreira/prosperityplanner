import { signOut } from "./actions";
import { CostSection } from "@/components/CostTables";
import { buildCostTable, type CostRow } from "@/lib/costs";
import { buildPeriods, earliestDate } from "@/lib/periods";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE = 1000; // PostgREST's default max rows per request

async function fetchCosts(since: string): Promise<CostRow[]> {
  const supabase = await createClient();
  const rows: CostRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("cost_by_category_month")
      .select("month, category, expense")
      .gte("month", since)
      .order("month")
      .order("category")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data as CostRow[]));
    if (data.length < PAGE) return rows;
  }
}

export default async function Dashboard() {
  const { years, l12m, ytd } = buildPeriods(new Date());
  const periods = [...years, l12m, ytd];
  const rows = await fetchCosts(earliestDate(periods));

  const total = buildCostTable(rows, periods, "total", l12m);
  const average = buildCostTable(rows, periods, "monthlyAverage", l12m);

  return (
    <main>
      <header>
        <h1>Costs by category</h1>
        <form action={signOut}><button type="submit" className="link">Sign out</button></form>
      </header>
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
    </main>
  );
}
