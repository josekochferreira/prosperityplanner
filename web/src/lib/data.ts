import { createClient } from "@/lib/supabase/server";
import type { CostRow } from "@/lib/costs";

const PAGE = 1000; // PostgREST's default max rows per request

export async function fetchCosts(since: string): Promise<CostRow[]> {
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

export type PortfolioSnapshot = {
  date: string;
  currency: string | null;
  value: number;
  costBase: number;
  totalGain: number;
};

export type Holding = {
  symbol: string | null;
  name: string | null;
  value: number;
  totalGain: number | null;
  totalGainPercent: number | null;
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Latest snapshot date, summed across portfolios; null when nothing has synced yet. */
export async function fetchPortfolio(): Promise<{ snapshot: PortfolioSnapshot; holdings: Holding[] } | null> {
  const supabase = await createClient();
  const { data: latest, error } = await supabase
    .from("sharesight_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  if (!latest?.length) return null;
  const date = latest[0].snapshot_date as string;

  const [snaps, holds, portfolios] = await Promise.all([
    supabase.from("sharesight_snapshots").select("value, cost_base, total_gain").eq("snapshot_date", date),
    supabase
      .from("sharesight_holdings")
      .select("symbol, name, value, total_gain, total_gain_percent")
      .eq("snapshot_date", date)
      .order("value", { ascending: false }),
    supabase.from("sharesight_portfolios").select("currency"),
  ]);
  for (const r of [snaps, holds, portfolios]) if (r.error) throw new Error(r.error.message);

  const sum = (key: "value" | "cost_base" | "total_gain") =>
    (snaps.data ?? []).reduce((acc, r) => acc + (num(r[key]) ?? 0), 0);
  const currencies = new Set((portfolios.data ?? []).map((p) => p.currency).filter(Boolean));

  return {
    snapshot: {
      date,
      currency: currencies.size === 1 ? ([...currencies][0] as string) : null,
      value: sum("value"),
      costBase: sum("cost_base"),
      totalGain: sum("total_gain"),
    },
    holdings: (holds.data ?? []).map((h) => ({
      symbol: h.symbol,
      name: h.name,
      value: num(h.value) ?? 0,
      totalGain: num(h.total_gain),
      totalGainPercent: num(h.total_gain_percent),
    })),
  };
}
