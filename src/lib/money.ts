/**
 * Rupee arithmetic without drift.
 *
 * Money is stored as Decimal(12,2) in Postgres, which is exact, but JavaScript
 * numbers are not: 0.1 + 0.2 is famously not 0.3. Every sum, difference or
 * comparison here goes through integer paise, so a month of small site
 * expenses adds up to the same figure the site counted by hand.
 */

/** Rupees (number, string or Prisma Decimal) to integer paise. */
export function toPaise(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const s = typeof value === "string" ? value : String(value);
  const n = Number(s);
  if (!isFinite(n)) throw new Error(`Not an amount: ${s}`);
  return Math.round(n * 100);
}

/** Integer paise back to rupees, for display or for writing to a Decimal column. */
export function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}

export function sumPaise(values: readonly unknown[]): number {
  return values.reduce<number>((a, v) => a + toPaise(v), 0);
}

/** Sum a column of Decimal amounts exactly. */
export function sumAmounts(values: readonly unknown[]): number {
  return toRupees(sumPaise(values));
}
