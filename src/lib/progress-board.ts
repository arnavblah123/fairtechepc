import "server-only";
import type { Shift, Trade } from "@prisma/client";
import { prisma } from "./prisma";
import { dateKeyToDate, dateToKey, daysBetween } from "./format";

export type BoardWorker = { id: string; code: string; name: string; trade: Trade };
export type BoardStage = {
  id: string;
  name: string;
  unit: string;
  plannedQty: number;
  plannedDays: number;
  daysUsed: number;
  doneSoFar: number;
  done: boolean;
  entry: { qtyDone: string; remark: string; workers: { workerId: string; hours: number; shift: Shift }[] } | null;
};

/** Everyone active on the site, and who is already on which stage for the date. */
export async function siteWorkersForDate(siteId: string, dateKeyStr: string) {
  const dateObj = dateKeyToDate(dateKeyStr);
  const [workers, logs] = await Promise.all([
    prisma.worker.findMany({ where: { siteId, active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, trade: true } }),
    prisma.stageWorkLog.findMany({ where: { date: dateObj, worker: { siteId } }, include: { stageProgress: { include: { stage: { select: { id: true, name: true } } } } } }),
  ]);
  return {
    workers: workers as BoardWorker[],
    busyWorkers: Object.fromEntries(logs.map((l) => [`${l.workerId}:${l.shift}`, l.stageProgress.stage.name])) as Record<string, string>,
    assignedWorkerIds: new Set(logs.map((l) => l.workerId)),
  };
}

/** Stage rows for one job as the progress editor wants them, for a given date. */
export async function stageRowsForJob(jobId: string, dateKeyStr: string, today: string): Promise<BoardStage[]> {
  const dateObj = dateKeyToDate(dateKeyStr);
  const [stages, todaysProgress, allProgress] = await Promise.all([
    prisma.stage.findMany({ where: { jobId, voidedAt: null }, orderBy: { sequence: "asc" } }),
    prisma.stageProgress.findMany({ where: { jobId, date: dateObj, voidedAt: null }, include: { workLogs: true } }),
    prisma.stageProgress.groupBy({ by: ["stageId"], where: { jobId, voidedAt: null }, _sum: { qtyDone: true } }),
  ]);
  const cumulative = new Map(allProgress.map((p) => [p.stageId, Number(p._sum.qtyDone ?? 0)]));
  return stages.map((s) => {
    const p = todaysProgress.find((x) => x.stageId === s.id);
    return {
      id: s.id,
      name: `${s.sequence}. ${s.name}`,
      unit: s.unit,
      plannedQty: Number(s.plannedQty),
      plannedDays: s.plannedDays,
      daysUsed: s.actualStart ? daysBetween(dateToKey(s.actualStart), s.actualEnd ? dateToKey(s.actualEnd) : today) + 1 : 0,
      doneSoFar: cumulative.get(s.id) ?? 0,
      done: !!s.actualEnd,
      entry: p ? { qtyDone: String(Number(p.qtyDone)), remark: p.remark ?? "", workers: p.workLogs.map((w) => ({ workerId: w.workerId, hours: Number(w.hours), shift: w.shift })) } : null,
    };
  });
}
