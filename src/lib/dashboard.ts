import "server-only";
import { prisma } from "./prisma";
import { istDateKey, istHour, addDays, dateKeyToDate, dateToKey } from "./format";
import { jobStageSummary } from "./jobs";
import { weldingNormForJob } from "./consumables";
import { pettyBalance, pettyBurnRate } from "./petty";

export type SiteDash = Awaited<ReturnType<typeof siteDashboard>>;

/** Everything the morning screen needs for one site, exception-first. */
export async function siteDashboard(siteId: string) {
  const today = istDateKey();
  const yesterday = addDays(today, -1);
  const [site, dprY, holidayY, photosToday, attendanceToday, planToday, activeJobs, pendingCons, pendingPetty, pendingAdv, openIssues, machines, balance, burn, workersActive] =
    await Promise.all([
      prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, name: true, code: true, city: true, pettyCashThreshold: true } }),
      prisma.dPR.findUnique({ where: { siteId_date: { siteId, date: dateKeyToDate(yesterday) } } }),
      prisma.holiday.findUnique({ where: { siteId_date: { siteId, date: dateKeyToDate(yesterday) } } }),
      prisma.sitePhoto.findMany({ where: { siteId, kind: "DAILY_SLOT", date: dateKeyToDate(today), voidedAt: null }, select: { slot: true } }),
      prisma.attendance.findMany({ where: { siteId, date: dateKeyToDate(today) }, select: { status: true } }),
      prisma.dailyPlan.findUnique({ where: { siteId_date: { siteId, date: dateKeyToDate(today) } }, include: { items: { select: { manpowerPlanned: true } } } }),
      prisma.job.findMany({ where: { siteId, voidedAt: null, status: "ACTIVE" }, select: { id: true, jobNumber: true, name: true, plannedTonnage: true, plannedStart: true, plannedEnd: true } }),
      prisma.consumableRequest.findMany({ where: { siteId, status: "PENDING", voidedAt: null }, orderBy: { requestedAt: "asc" }, include: { item: { select: { name: true, unit: true } }, requestedBy: { select: { name: true } } } }),
      prisma.pettyCashRequest.findMany({ where: { siteId, status: "PENDING", voidedAt: null }, orderBy: { requestedAt: "asc" }, include: { requestedBy: { select: { name: true } } } }),
      prisma.advance.findMany({ where: { siteId, status: "PENDING", voidedAt: null }, orderBy: { requestedAt: "asc" }, include: { worker: { select: { code: true, name: true } }, requestedBy: { select: { name: true } } } }),
      prisma.issue.findMany({ where: { siteId, status: { not: "RESOLVED" }, voidedAt: null }, orderBy: [{ raisedAt: "asc" }], select: { id: true, severity: true, category: true, description: true, raisedAt: true } }),
      prisma.machine.groupBy({ by: ["status"], where: { siteId, active: true }, _count: true }),
      pettyBalance(siteId),
      pettyBurnRate(siteId),
      prisma.worker.count({ where: { siteId, active: true } }),
    ]);

  // DPR missing = yesterday was a working day with no submitted DPR (or today's, after cutoff).
  const dprMissingYesterday = !holidayY && dprY?.status !== "SUBMITTED";
  const dprToday = await prisma.dPR.findUnique({ where: { siteId_date: { siteId, date: dateKeyToDate(today) } } });
  const dprMissingToday = istHour() >= 20 && dprToday?.status !== "SUBMITTED";

  const slotsFilled = [...new Set(photosToday.map((p) => p.slot).filter((s): s is number => s !== null))];
  const present = attendanceToday.filter((a) => a.status === "PRESENT").length + 0.5 * attendanceToday.filter((a) => a.status === "HALF_DAY").length;
  const planned = planToday?.items.reduce((a, i) => a + i.manpowerPlanned, 0) ?? null;

  const jobsBehind: { id: string; jobNumber: string; name: string; bottleneck: string; overrun: number; percent: number }[] = [];
  const progressSeries: { jobId: string; plannedMT: number; start: string; end: string; overallPercent: number }[] = [];
  const normFlags: { jobNumber: string; actual: number; norm: number }[] = [];
  for (const j of activeJobs) {
    const s = await jobStageSummary(j.id);
    progressSeries.push({ jobId: j.id, plannedMT: Number(j.plannedTonnage), start: dateToKey(j.plannedStart), end: dateToKey(j.plannedEnd), overallPercent: s.overallPercent });
    if (s.bottleneck) jobsBehind.push({ id: j.id, jobNumber: j.jobNumber, name: j.name, bottleneck: s.bottleneck.name, overrun: s.bottleneck.daysOverrun, percent: s.overallPercent });
    const n = await weldingNormForJob(j.id);
    if (n.over && n.actualKgPerMT !== null && n.normKgPerMT !== null) normFlags.push({ jobNumber: j.jobNumber, actual: Math.round(n.actualKgPerMT * 100) / 100, norm: n.normKgPerMT });
  }
  jobsBehind.sort((a, b) => b.overrun - a.overrun);

  const lowStock = await prisma.consumableStock.findMany({
    where: { siteId, item: { active: true } },
    include: { item: { select: { name: true, unit: true, reorderLevel: true } } },
  });
  const lowItems = lowStock.filter((s) => Number(s.qtyOnHand) <= Number(s.item.reorderLevel)).map((s) => ({ name: s.item.name, qty: Number(s.qtyOnHand), unit: s.item.unit }));

  const machineCounts = Object.fromEntries(machines.map((m) => [m.status, m._count]));

  // Actual cumulative MT proxy: average daily MT progressed across each job's MT stages.
  const mtProgress = await prisma.stageProgress.findMany({
    where: { siteId, voidedAt: null, stage: { unit: "MT" }, job: { status: "ACTIVE", voidedAt: null } },
    select: { date: true, qtyDone: true, jobId: true },
  });
  const mtStageCounts = await prisma.stage.groupBy({ by: ["jobId"], where: { siteId, voidedAt: null, unit: "MT" }, _count: true });
  const stageCountMap = new Map(mtStageCounts.map((m) => [m.jobId, m._count]));
  const daily = new Map<string, number>();
  for (const p of mtProgress) {
    const k = dateToKey(p.date);
    daily.set(k, (daily.get(k) ?? 0) + Number(p.qtyDone) / Math.max(1, stageCountMap.get(p.jobId) ?? 1));
  }
  const actualSeries = [...daily.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  let cum = 0;
  const actualCum = actualSeries.map(([date, v]) => ({ date, mt: Math.round((cum += v) * 100) / 100 }));
  const totalPlannedMT = activeJobs.reduce((a, j) => a + Number(j.plannedTonnage), 0);
  const planStart = progressSeries.length ? progressSeries.map((p) => p.start).sort()[0] : today;
  const planEnd = progressSeries.length ? progressSeries.map((p) => p.end).sort().at(-1)! : today;

  return {
    site: { id: site.id, name: site.name, code: site.code, city: site.city },
    today,
    yesterday,
    dprMissingYesterday,
    dprMissingToday,
    dprYesterdaySubmitted: dprY?.status === "SUBMITTED",
    holidayYesterday: !!holidayY,
    slotsFilled,
    present,
    planned,
    workersActive,
    jobsBehind,
    normFlags,
    lowItems,
    pendingCons: pendingCons.map((r) => ({ id: r.id, label: `${r.item.name} × ${Number(r.qty)} ${r.item.unit}`, sub: `${r.reason} — ${r.requestedBy.name}` })),
    pendingPetty: pendingPetty.map((r) => ({ id: r.id, amount: Number(r.amount), sub: `${r.reason} — ${r.requestedBy.name}`, urgency: r.urgency })),
    pendingAdv: pendingAdv.map((r) => ({ id: r.id, amount: Number(r.amount), sub: `${r.worker.code} ${r.worker.name}: ${r.reason}` })),
    openIssues: openIssues.map((i) => ({ id: i.id, severity: i.severity, category: i.category, description: i.description.slice(0, 100), ageHours: Math.round((Date.now() - i.raisedAt.getTime()) / 3600000) })),
    machineCounts,
    pettyBalance: balance,
    pettyThreshold: Number(site.pettyCashThreshold),
    burnRate: burn,
    chart: { totalPlannedMT, planStart, planEnd, actualCum },
  };
}
