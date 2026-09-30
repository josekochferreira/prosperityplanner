import { describe, expect, it } from "vitest";
import { buildCostTable, type CostRow } from "./costs";
import { buildPeriods, earliestDate } from "./periods";

// "Today" is 15 Sep 2026: last completed month is Aug 2026.
const today = new Date(Date.UTC(2026, 8, 15));
const { years, l12m, ytd } = buildPeriods(today);

describe("buildPeriods", () => {
  it("uses the three completed calendar years", () => {
    expect(years.map((y) => y.label)).toEqual(["2023", "2024", "2025"]);
    expect(years.every((y) => y.months === 12)).toBe(true);
  });
  it("last 12 months are the 12 completed months before the current month", () => {
    expect(l12m.span).toBe("Sep 2025 – Aug 2026");
    expect(l12m.months).toBe(12);
  });
  it("YTD runs January to the last completed month", () => {
    expect(ytd.span).toBe("Jan 2026 – Aug 2026");
    expect(ytd.months).toBe(8);
  });
  it("YTD is empty in January and L12M crosses the year boundary", () => {
    const jan = buildPeriods(new Date(Date.UTC(2027, 0, 10)));
    expect(jan.ytd.months).toBe(0);
    expect(jan.l12m.span).toBe("Jan 2026 – Dec 2026");
    expect(jan.years.map((y) => y.label)).toEqual(["2024", "2025", "2026"]);
  });
  it("earliest fetch date is the start of the oldest year", () => {
    expect(earliestDate([...years, l12m, ytd])).toBe("2023-01-01");
  });
});

const rows: CostRow[] = [
  { month: "2023-06-01", category: "Travel", expense: 1000 },
  { month: "2025-12-01", category: "Rent", expense: "1200.10" },
  { month: "2025-09-01", category: "Rent", expense: 1200 }, // inside L12M and year 2025
  { month: "2026-03-01", category: "Rent", expense: 1200 }, // L12M and YTD
  { month: "2026-03-01", category: "Food", expense: 300 },
  { month: "2026-09-01", category: "Food", expense: 999 }, // current month: excluded everywhere
  { month: "2022-12-01", category: "Old", expense: 5 }, // before all periods
];
const all = [...years, l12m, ytd];

describe("buildCostTable", () => {
  const total = buildCostTable(rows, all, "total", l12m);
  const col = (name: string) => all.findIndex((p) => p.label === name);
  const get = (cat: string, name: string) =>
    total.rows.find((r) => r.category === cat)!.values[col(name)];

  it("sums per category and period", () => {
    expect(get("Rent", "2025")).toBe(2400.1);
    expect(get("Travel", "2023")).toBe(1000);
    expect(get("Rent", "Last 12 months")).toBe(3600.1);
    expect(get("Rent", "2026 year to date")).toBe(1200);
    expect(get("Food", "2026 year to date")).toBe(300);
  });
  it("excludes the current month and out-of-range months", () => {
    expect(get("Food", "Last 12 months")).toBe(300);
    expect(total.rows.find((r) => r.category === "Old")!.values.every((v) => v === 0)).toBe(true);
  });
  it("sorts by the last-12-months total", () => {
    expect(total.rows.slice(0, 2).map((r) => r.category)).toEqual(["Rent", "Food"]);
  });
  it("totals row adds categories", () => {
    expect(total.totals[col("2025")]).toBe(2400.1);
    expect(total.totals[col("Last 12 months")]).toBe(3900.1);
  });
  it("monthly average divides by the period's months", () => {
    const avg = buildCostTable(rows, all, "monthlyAverage", l12m);
    const rent = avg.rows.find((r) => r.category === "Rent")!;
    expect(rent.values[col("2025")]).toBeCloseTo(2400.1 / 12, 6);
    expect(rent.values[col("2026 year to date")]).toBe(1200 / 8);
  });
  it("average is null when the period has no months", () => {
    const jan = buildPeriods(new Date(Date.UTC(2027, 0, 10)));
    const t = buildCostTable(rows, [jan.ytd], "monthlyAverage", jan.ytd);
    expect(t.totals).toEqual([null]);
  });
});
