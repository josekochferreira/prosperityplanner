const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const money = (v: number | null | undefined, currency?: string | null) =>
  v === null || v === undefined ? "—" : `${currency ? currency + " " : ""}${whole.format(v)}`;

export const percent = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
