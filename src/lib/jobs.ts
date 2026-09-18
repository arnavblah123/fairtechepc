import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { dateToKey, daysBetween, istDateKey } from "./format";

/** Next job number for a site, e.g. SITE-007. Counts voided jobs too so numbers are never reused. */
export async function nextJobNumber(tx: Prisma.TransactionClient, siteId: string): Promise<string> {
  const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { code: true } });
  const count = await tx.job.count({ where: { siteId } });
  return `${site.code}-${String(count + 1).padStart(3, "0")}`;
}

export type StageSummary = {
  id: string;
  sequence: number;
  name: string;
  unit: string;
  plannedQty: number;
  plannedDays: number;
  actualQty: number;
  /** Derived from quantity done — never typed in by anyone. */
  percent: number;
  actualStart: string | null;
  actualEnd: string | null;
  daysUsed: number;
  daysOverrun: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
};

/**
 * Stage-wise planned vs actual for one job.
 *
 * Progress is measured only by quantity completed against the stage's planned
 * quantity, or by the stage being marked finished. Nobody types a percentage,
 * and tonnage is not used as the yardstick. The job's overall figure weights
 * each stage by its planned days, so a 25-day welding stage counts for more
 * than a 6-day inspection.
 */
export async function jobStageSummary(jobId: string): Promise<{
  stages: StageSummary[];
  bottleneck: StageSummary | null;
  overallPercent: number;
  plannedPercentToday: number;
}> {
  const stages = await prisma.stage.findMany({
    where: { jobId, voidedAt: null },
    orderBy: { sequence: "asc" },
    include: { progress: { where: { voidedAt: null }, orderBy: { date: "desc" }, select: { date: true, qtyDone: true } } },
  });
  const today = istDateKey();

  const out: StageSummary[] = stages.map((s) => {
    const actualQty = s.progress.reduce((a, p) => a + Number(p.qtyDone), 0);
    const plannedQty = Number(s.plannedQty);
    const firstDate = s.progress.length ? dateToKey(s.progress[s.progress.length - 1].date) : null;
    const actualStart = s.actualStart ? dateToKey(s.actualStart) : firstDate;
    const actualEnd = s.actualEnd ? dateToKey(s.actualEnd) : null;
    const percent = actualEnd ? 100 : plannedQty > 0 ? Math.min(100, (actualQty / plannedQty) * 100) : 0;
    const status: StageSummary["status"] = actualEnd ? "DONE" : actualStart ? "IN_PROGRESS" : "NOT_STARTED";
    const daysUsed = actualStart ? daysBetween(actualStart, actualEnd ?? today) + 1 : 0;
    return {
      id: s.id,
      sequence: s.sequence,
      name: s.name,
      unit: s.unit,
      plannedQty,
      plannedDays: s.plannedDays,
      actualQty,
      percent,
      actualStart,
      actualEnd,
      daysUsed,
      daysOverrun: Math.max(0, daysUsed - s.plannedDays),
      status,
    };
  });

  // Weight each stage by its planned days; stages with no plan fall back to equal weight.
  const totalWeight = out.reduce((a, s) => a + (s.plannedDays || 1), 0);
  const overallPercent = totalWeight ? Math.round(out.reduce((a, s) => a + s.percent * (s.plannedDays || 1), 0) / totalWeight) : 0;

  // A stage running over its planned days while unfinished is the bottleneck.
  const bottleneck = out.filter((s) => s.daysOverrun > 0 && s.status !== "DONE").sort((a, b) => b.daysOverrun - a.daysOverrun)[0] ?? null;

  return { stages: out, bottleneck, overallPercent, plannedPercentToday: 0 };
}

/** Where the job should be today, by elapsed days against the planned window. */
export function plannedPercentByDate(plannedStart: Date, plannedEnd: Date, onKey = istDateKey()): number {
  const start = dateToKey(plannedStart);
  const end = dateToKey(plannedEnd);
  const total = daysBetween(start, end) + 1;
  if (total <= 0) return 0;
  const elapsed = daysBetween(start, onKey) + 1;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}
