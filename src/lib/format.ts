// All dates in DD-MM-YYYY, all times in IST, all money in Indian format.

export const IST_OFFSET_MIN = 330; // +05:30
const IST_TZ = "Asia/Kolkata";

/** Returns the IST calendar date (YYYY-MM-DD) for a given instant (default now). */
export function istDateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Current hour (0-23) in IST. */
export function istHour(d: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: IST_TZ, hour: "2-digit", hour12: false }).format(d),
  );
}

/** Convert YYYY-MM-DD to a Date at UTC midnight, which is what Prisma @db.Date expects. */
export function dateKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Convert a Prisma @db.Date value back to YYYY-MM-DD. */
export function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, n: number): string {
  const d = dateKeyToDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((dateKeyToDate(b).getTime() - dateKeyToDate(a).getTime()) / 86400000);
}

/** DD-MM-YYYY from a Date (as stored, UTC midnight) or a YYYY-MM-DD key. */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const key = typeof d === "string" ? d : dateToKey(d);
  const [y, m, day] = key.split("-");
  return `${day}-${m}-${y}`;
}

/** DD-MM-YYYY HH:MM in IST for a real instant. */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}`;
}

/** ₹1,25,000 style. Accepts number, string or Prisma Decimal. */
export function formatINR(value: unknown, opts: { decimals?: number } = {}): string {
  const n = typeof value === "number" ? value : Number(value?.toString() ?? 0);
  if (!isFinite(n)) return "₹0";
  const decimals = opts.decimals ?? (Number.isInteger(n) ? 0 : 2);
  return (
    "₹" +
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n)
  );
}

/** Plain Indian-grouped number without ₹, e.g. 12,50,000.5 */
export function formatNum(value: unknown, decimals = 3): string {
  const n = typeof value === "number" ? value : Number(value?.toString() ?? 0);
  if (!isFinite(n)) return "0";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: decimals }).format(n);
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.min(100, Math.round((part / whole) * 1000) / 10);
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
