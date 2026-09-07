import "server-only";
import { prisma } from "./prisma";
import { dateKeyToDate, dateToKey, titleCase } from "./format";

export type DprData = {
  date: string;
  holiday: string | null;
  manpower: { trade: string; present: number; halfDay: number; absent: number; otHours: number }[];
  totalPresent: number;
  plan: { job: string; stage: string; unit: string; targetQty: number; doneQty: number; manpowerPlanned: number }[];
  extraProgress: { job: string; stage: string; unit: string; doneQty: number; percent: number }[];
  consumables: { item: string; unit: string; qty: number; job: string }[];
  machines: { status: string; count: number }[];
  openIssues: { severity: string; category: string; description: string; ageHours: number }[];
  photos: { url: string; slot: number | null; caption: string | null; latitude: number; longitude: number }[];
  photoSlotsFilled: number[];
};

/** Compile the day's report from live records. Used for preview and frozen on submit. */
export async function compileDpr(siteId: string, dateKeyStr: string): Promise<DprData> {
  const date = dateKeyToDate(dateKeyStr);
  const [holiday, attendance, plan, progress, consumption, machines, issues, photos] = await Promise.all([
    prisma.holiday.findUnique({ where: { siteId_date: { siteId, date } } }),
    prisma.attendance.findMany({ where: { siteId, date }, include: { worker: { select: { trade: true } } } }),
    prisma.dailyPlan.findUnique({ where: { siteId_date: { siteId, date } }, include: { items: { include: { job: true, stage: true } } } }),
    prisma.stageProgress.findMany({ where: { siteId, date, voidedAt: null }, include: { job: true, stage: true } }),
    prisma.consumableConsumption.findMany({ where: { siteId, date, voidedAt: null }, include: { item: true, job: true } }),
    prisma.machine.groupBy({ by: ["status"], where: { siteId, active: true }, _count: true }),
    prisma.issue.findMany({ where: { siteId, status: { not: "RESOLVED" }, voidedAt: null }, orderBy: { raisedAt: "asc" } }),
    prisma.sitePhoto.findMany({ where: { siteId, date, kind: "DAILY_SLOT", voidedAt: null }, orderBy: { serverTime: "asc" } }),
  ]);

  const manpowerMap = new Map<string, { present: number; halfDay: number; absent: number; otHours: number }>();
  for (const a of attendance) {
    const t = a.worker.trade;
    const m = manpowerMap.get(t) ?? { present: 0, halfDay: 0, absent: 0, otHours: 0 };
    if (a.status === "PRESENT") m.present++;
    else if (a.status === "HALF_DAY") m.halfDay++;
    else if (a.status === "ABSENT") m.absent++;
    m.otHours += Number(a.otHours);
    manpowerMap.set(t, m);
  }

  const progressByStage = new Map(progress.map((p) => [p.stageId, p]));
  const planItems = (plan?.items ?? []).map((i) => ({
    job: i.job.jobNumber,
    stage: i.stage.name,
    unit: i.stage.unit,
    targetQty: Number(i.targetQty),
    doneQty: Number(progressByStage.get(i.stageId)?.qtyDone ?? 0),
    manpowerPlanned: i.manpowerPlanned,
  }));
  const plannedStageIds = new Set((plan?.items ?? []).map((i) => i.stageId));
  const extraProgress = progress
    .filter((p) => !plannedStageIds.has(p.stageId))
    .map((p) => ({ job: p.job.jobNumber, stage: p.stage.name, unit: p.stage.unit, doneQty: Number(p.qtyDone), percent: Number(p.percentComplete) }));

  return {
    date: dateKeyStr,
    holiday: holiday?.name ?? null,
    manpower: [...manpowerMap.entries()].map(([trade, m]) => ({ trade: titleCase(trade), ...m })),
    totalPresent: attendance.filter((a) => a.status === "PRESENT").length + 0.5 * attendance.filter((a) => a.status === "HALF_DAY").length,
    plan: planItems,
    extraProgress,
    consumables: consumption.map((c) => ({ item: c.item.name, unit: c.item.unit, qty: Number(c.qty), job: c.job.jobNumber })),
    machines: machines.map((m) => ({ status: titleCase(m.status), count: m._count })),
    openIssues: issues.map((i) => ({
      severity: i.severity,
      category: titleCase(i.category),
      description: i.description.slice(0, 200),
      ageHours: Math.round((Date.now() - i.raisedAt.getTime()) / 3600000),
    })),
    photos: photos.map((p) => ({ url: p.url, slot: p.slot, caption: p.caption, latitude: p.latitude, longitude: p.longitude })),
    photoSlotsFilled: [...new Set(photos.map((p) => p.slot).filter((s): s is number => s !== null))].sort(),
  };
}

/** DPR status for a past/current date: SUBMITTED row wins; otherwise derive. */
export async function dprStatus(siteId: string, dateKeyStr: string) {
  const dpr = await prisma.dPR.findUnique({ where: { siteId_date: { siteId, date: dateKeyToDate(dateKeyStr) } }, include: { submittedBy: { select: { name: true } } } });
  return dpr;
}

export function dateKeyOf(d: Date) {
  return dateToKey(d);
}
