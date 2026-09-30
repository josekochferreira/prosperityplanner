/**
 * Reporting periods. Months are handled as a month index (year * 12 + month0)
 * so there is no timezone or day-of-month arithmetic.
 *
 * Rules (all based on COMPLETED months, so averages are not skewed by a half-finished month):
 *  - Year columns: the three most recent completed calendar years.
 *  - Last 12 months: the 12 completed months before the current month.
 *  - Year to date: January through the last completed month of the current year.
 */

export type Period = {
  key: string;
  label: string;
  /** Human-readable span, shown under the column heading. */
  span: string;
  startMi: number;
  endMi: number;
  /** Number of months in the period; 0 means nothing to report yet (e.g. YTD in January). */
  months: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const monthIndex = (year: number, month0: number) => year * 12 + month0;

/** "2026-03-01" -> month index. */
export function monthIndexFromDate(iso: string): number {
  return monthIndex(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1);
}

const fmt = (mi: number) => `${MONTHS[mi % 12]} ${Math.floor(mi / 12)}`;

function period(key: string, label: string, startMi: number, endMi: number): Period {
  const months = Math.max(0, endMi - startMi + 1);
  return { key, label, span: months ? `${fmt(startMi)} – ${fmt(endMi)}` : "no completed months", startMi, endMi, months };
}

export function buildPeriods(today: Date): { years: Period[]; l12m: Period; ytd: Period } {
  const year = today.getUTCFullYear();
  const currentMi = monthIndex(year, today.getUTCMonth());
  const lastComplete = currentMi - 1;

  const years = [year - 3, year - 2, year - 1].map((y) =>
    period(`y${y}`, String(y), monthIndex(y, 0), monthIndex(y, 11)),
  );
  return {
    years,
    l12m: period("l12m", "Last 12 months", lastComplete - 11, lastComplete),
    ytd: period("ytd", `${year} year to date`, monthIndex(year, 0), lastComplete),
  };
}

/** First day (YYYY-MM-DD) that needs to be fetched to cover all periods. */
export function earliestDate(periods: Period[]): string {
  const mi = Math.min(...periods.map((p) => p.startMi));
  return `${Math.floor(mi / 12)}-${String((mi % 12) + 1).padStart(2, "0")}-01`;
}
