import { monthIndexFromDate, type Period } from "./periods";

/** One row of the cost_by_category_month view. */
export type CostRow = { month: string; category: string; expense: number | string };

export type CostMode = "total" | "monthlyAverage";

export type CostTable = {
  periods: Period[];
  rows: { category: string; values: (number | null)[] }[];
  totals: (number | null)[];
};

const toCents = (v: number | string) => Math.round(Number(v) * 100);

/**
 * Aggregate rows into a category x period table.
 * Sums are kept in integer cents to avoid floating-point drift; values are returned in currency units.
 * Average mode divides by the period's months; periods with 0 months yield null.
 * Categories are ordered by their total over `sortPeriod` (descending), then by name.
 */
export function buildCostTable(
  rows: CostRow[],
  periods: Period[],
  mode: CostMode,
  sortPeriod: Period,
): CostTable {
  const byCategory = new Map<string, number[]>(); // category -> cents per period
  let sortCents = new Map<string, number>();

  for (const row of rows) {
    const mi = monthIndexFromDate(row.month);
    const cents = toCents(row.expense);
    let sums = byCategory.get(row.category);
    if (!sums) byCategory.set(row.category, (sums = periods.map(() => 0)));
    periods.forEach((p, i) => {
      if (mi >= p.startMi && mi <= p.endMi) sums![i] += cents;
    });
    if (mi >= sortPeriod.startMi && mi <= sortPeriod.endMi) {
      sortCents.set(row.category, (sortCents.get(row.category) ?? 0) + cents);
    }
  }

  const value = (cents: number, p: Period): number | null => {
    if (mode === "total") return cents / 100;
    return p.months > 0 ? cents / 100 / p.months : null;
  };

  const ordered = [...byCategory.keys()].sort(
    (a, b) => (sortCents.get(b) ?? 0) - (sortCents.get(a) ?? 0) || a.localeCompare(b),
  );
  const totalsCents = periods.map((_, i) => ordered.reduce((s, c) => s + byCategory.get(c)![i], 0));

  return {
    periods,
    rows: ordered.map((category) => ({
      category,
      values: byCategory.get(category)!.map((c, i) => value(c, periods[i])),
    })),
    totals: totalsCents.map((c, i) => value(c, periods[i])),
  };
}
