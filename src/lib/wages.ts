import "server-only";
import type { Prisma, WagePeriod } from "@prisma/client";
import { prisma } from "./prisma";
import { addDays, dateKeyToDate } from "./format";
import { ApiError } from "./api";

/** Period end (inclusive): 6 days after start for weekly, end of month for monthly. */
export function periodEnd(period: WagePeriod, startKey: string): string {
  if (period === "WEEKLY") return addDays(startKey, 6);
  const [y, m] = startKey.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/**
 * (Re)generate wage sheets for every active worker of the site for a period.
 * DRAFT sheets are replaced; FINAL/PAID sheets are left untouched.
 * Approved, undeducted advances are linked and deducted.
 */
export async function generateWageSheets(siteId: string, period: WagePeriod, startKey: string, userId: string) {
  const endKey = periodEnd(period, startKey);
  const start = dateKeyToDate(startKey);
  const end = dateKeyToDate(endKey);
  const workers = await prisma.worker.findMany({
    where: { siteId, OR: [{ active: true }, { attendance: { some: { date: { gte: start, lte: end } } } }] },
    include: {
      wageRates: { where: { effectiveFrom: { lte: end } }, orderBy: { effectiveFrom: "desc" }, take: 1 },
      attendance: { where: { date: { gte: start, lte: end } } },
    },
  });
  const results: { workerId: string; skipped?: string }[] = [];
  for (const w of workers) {
    const existing = await prisma.wageSheet.findUnique({ where: { workerId_period_periodStart: { workerId: w.id, period, periodStart: start } } });
    if (existing && existing.status !== "DRAFT") {
      results.push({ workerId: w.id, skipped: existing.status });
      continue;
    }
    const rateRow = w.wageRates[0];
    const rate = rateRow ? Number(rateRow.rate) : 0;
    const hourly = w.wageType === "PER_HOUR" ? rate : rate / 8;
    const otRate = rateRow?.otRate ? Number(rateRow.otRate) : hourly * 1.5;
    let daysPresent = 0, hours = 0, otHours = 0;
    for (const a of w.attendance) {
      if (a.status === "PRESENT") { daysPresent += 1; hours += hoursOf(a.inTime, a.outTime) ?? 8; }
      else if (a.status === "HALF_DAY") { daysPresent += 0.5; hours += hoursOf(a.inTime, a.outTime) ?? 4; }
      otHours += Number(a.otHours);
    }
    const gross = w.wageType === "PER_DAY" ? rate * daysPresent + otRate * otHours : rate * hours + otRate * otHours;
    await prisma.$transaction(async (tx) => {
      if (existing) await tx.advance.updateMany({ where: { wageSheetId: existing.id }, data: { wageSheetId: null } });
      const advances = await tx.advance.findMany({ where: { workerId: w.id, status: "APPROVED", wageSheetId: null, voidedAt: null } });
      const advTotal = advances.reduce((a, x) => a + Number(x.amount), 0);
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const data = {
        daysPresent, hours: round2(hours), otHours: round2(otHours),
        grossWage: round2(gross), advancesDeducted: round2(advTotal), netPayable: round2(gross - advTotal),
        generatedById: userId, generatedAt: new Date(), status: "DRAFT" as const,
      };
      const sheet = existing
        ? await tx.wageSheet.update({ where: { id: existing.id }, data })
        : await tx.wageSheet.create({ data: { ...data, siteId, workerId: w.id, period, periodStart: start, periodEnd: end } });
      if (advances.length) await tx.advance.updateMany({ where: { id: { in: advances.map((a) => a.id) } }, data: { wageSheetId: sheet.id } });
    });
    results.push({ workerId: w.id });
  }
  return { endKey, count: results.filter((r) => !r.skipped).length, skipped: results.filter((r) => r.skipped).length };
}

function hoursOf(inTime: string | null, outTime: string | null): number | null {
  if (!inTime || !outTime) return null;
  const [ih, im] = inTime.split(":").map(Number);
  const [oh, om] = outTime.split(":").map(Number);
  const h = oh + om / 60 - (ih + im / 60);
  return h > 0 && h <= 16 ? Math.round(h * 2) / 2 : null;
}

export async function assertWageSheet(id: string): Promise<Prisma.WageSheetGetPayload<object>> {
  const s = await prisma.wageSheet.findFirst({ where: { id, voidedAt: null } });
  if (!s) throw new ApiError(404, "Wage sheet not found");
  return s;
}
