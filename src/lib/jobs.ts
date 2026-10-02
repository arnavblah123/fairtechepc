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
  /** Derived, never typed in. 100 only once the stage is ticked finished. */
  percent: number;
  /** Which signal `percent` came from, so the UI can say so. */
  basis: "DONE" | "QUANTITY" | "TIME" | "NONE";
  actualStart: string | null;
  actualEnd: string | null;
  daysUsed: number;
  daysOverrun: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
};

/**
 * Stage-wise planned vs actual for one job.
 *
 * Time is the yardstick: every stage has planned days, and the supervisor marks
 * when it is finished. Where a quantity was planned and entered, that gives a
 * truer reading and is used instead. Either way a stage never reads 100% until
 * it is ticked finished, and nobody types a percentage. The job's overall
 * figure weights each stage by its planned days, so a 25-day welding stage
 * counts for more than a 6-day inspection.
 */
export async function jobStageSummary(jobId: string): Promise<{
  stages: StageSummary[];
  bottleneck: StageSummary | null;
  overallPercent: number;
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
    const status: StageSummary["status"] = actualEnd ? "DONE" : actualStart ? "IN_PROGRESS" : "NOT_STARTED";
    const daysUsed = actualStart ? daysBetween(actualStart, actualEnd ?? today) + 1 : 0;

    let percent = 0;
    let basis: StageSummary["basis"] = "NONE";
    if (status === "DONE") {
      percent = 100;
      basis = "DONE";
    } else if (status === "IN_PROGRESS") {
      if (plannedQty > 0 && actualQty > 0) {
        percent = Math.min(99, (actualQty / plannedQty) * 100);
        basis = "QUANTITY";
      } else {
        // No quantity to go on: how far through its planned days it is.
        percent = Math.min(99, (daysUsed / Math.max(1, s.plannedDays)) * 100);
        basis = "TIME";
      }
    }

    return {
      id: s.id,
      sequence: s.sequence,
      name: s.name,
      unit: s.unit,
      plannedQty,
      plannedDays: s.plannedDays,
      actualQty,
      percent,
      basis,
      actualStart,
      actualEnd,
      daysUsed,
      daysOverrun: Math.max(0, daysUsed - s.plannedDays),
      status,
    };
  });

  const totalWeight = out.reduce((a, s) => a + (s.plannedDays || 1), 0);
  const overallPercent = totalWeight ? Math.round(out.reduce((a, s) => a + s.percent * (s.plannedDays || 1), 0) / totalWeight) : 0;

  // A stage running over its planned days while unfinished is the bottleneck.
  const bottleneck = out.filter((s) => s.daysOverrun > 0 && s.status !== "DONE").sort((a, b) => b.daysOverrun - a.daysOverrun)[0] ?? null;

  return { stages: out, bottleneck, overallPercent };
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
