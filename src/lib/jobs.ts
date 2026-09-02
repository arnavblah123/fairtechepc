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
  percent: number;
  actualStart: string | null;
  actualEnd: string | null;
  daysUsed: number;
  daysOverrun: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
};

/**
 * Stage-wise planned vs actual for one job. Actual quantity is the sum of daily
 * StageProgress entries; percent is the latest reported cumulative percent.
 */
export async function jobStageSummary(jobId: string): Promise<{ stages: StageSummary[]; bottleneck: StageSummary | null; overallPercent: number }> {
  const stages = await prisma.stage.findMany({
    where: { jobId, voidedAt: null },
    orderBy: { sequence: "asc" },
    include: {
      progress: { where: { voidedAt: null }, orderBy: { date: "desc" }, select: { date: true, qtyDone: true, percentComplete: true } },
    },
  });
  const today = istDateKey();
  const out: StageSummary[] = stages.map((s) => {
    const actualQty = s.progress.reduce((a, p) => a + Number(p.qtyDone), 0);
    const latest = s.progress[0];
    const firstDate = s.progress.length ? dateToKey(s.progress[s.progress.length - 1].date) : null;
    const actualStart = s.actualStart ? dateToKey(s.actualStart) : firstDate;
    const actualEnd = s.actualEnd ? dateToKey(s.actualEnd) : null;
    const percent = latest ? Number(latest.percentComplete) : 0;
    const status: StageSummary["status"] = actualEnd || percent >= 100 ? "DONE" : actualStart ? "IN_PROGRESS" : "NOT_STARTED";
    const daysUsed = actualStart ? daysBetween(actualStart, actualEnd ?? today) + 1 : 0;
    const daysOverrun = Math.max(0, daysUsed - s.plannedDays);
    return {
      id: s.id,
      sequence: s.sequence,
      name: s.name,
      unit: s.unit,
      plannedQty: Number(s.plannedQty),
      plannedDays: s.plannedDays,
      actualQty,
      percent: Math.min(100, Math.max(percent, s.plannedQty.toNumber() ? Math.min(100, (actualQty / Number(s.plannedQty)) * 100) : 0)),
      actualStart,
      actualEnd,
      daysUsed,
      daysOverrun,
      status,
    };
  });
  const bottleneck = out.filter((s) => s.daysOverrun > 0).sort((a, b) => b.daysOverrun - a.daysOverrun)[0] ?? null;
  const overallPercent = out.length ? Math.round(out.reduce((a, s) => a + s.percent, 0) / out.length) : 0;
  return { stages: out, bottleneck, overallPercent };
}
