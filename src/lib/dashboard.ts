import "server-only";
import { prisma } from "./prisma";
import { istDateKey, istHour, addDays, dateKeyToDate, dateToKey } from "./format";
import { jobStageSummary, plannedPercentByDate } from "./jobs";
import { weldingNormForJob } from "./consumables";
import { pettyBalance, pettyBurnRate } from "./petty";
import { balancesBySite } from "./ledger";
import { toPaise, toRupees } from "./money";

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

  // Petty cash expenses: what is waiting on Arnav, and where the money went this month.
  const monthStart = dateKeyToDate(today.slice(0, 8) + "01");
  const [pendingExpenses, monthSpend, cashHolders] = await Promise.all([
    prisma.expense.findMany({
      where: { siteId, status: { in: ["PENDING", "QUERIED"] }, voidedAt: null },
      orderBy: { date: "asc" },
      include: { category: { select: { name: true } }, spentBy: { select: { name: true } }, bill: { select: { id: true, payeeText: true, billPhotoUrl: true } } },
    }),
    prisma.expense.findMany({
      where: { siteId, status: "APPROVED", voidedAt: null, date: { gte: monthStart } },
      select: { amount: true, category: { select: { name: true } } },
    }),
    balancesBySite(siteId),
  ]);
  const byCategory = new Map<string, number>();
  for (const e of monthSpend) byCategory.set(e.category.name, (byCategory.get(e.category.name) ?? 0) + toPaise(e.amount));
  const spendByCategory = [...byCategory.entries()]
    .map(([name, paise]) => ({ name, amount: toRupees(paise) }))
    .sort((a, b) => b.amount - a.amount);
  const monthTotal = toRupees(monthSpend.reduce((a, e) => a + toPaise(e.amount), 0));
  const cashOnStreet = cashHolders.reduce((a, b) => a + b.inHand, 0);
  const pendingItems = await prisma.consumableItem.findMany({
    where: { approved: false, active: true },
    orderBy: { createdAt: "asc" },
    include: { proposedBy: { select: { name: true } } },
  });

  // DPR missing = yesterday was a working day with no submitted DPR (or today's, after cutoff).
  const dprMissingYesterday = !holidayY && dprY?.status !== "SUBMITTED";
  const dprToday = await prisma.dPR.findUnique({ where: { siteId_date: { siteId, date: dateKeyToDate(today) } } });
  const dprMissingToday = istHour() >= 20 && dprToday?.status !== "SUBMITTED";

  const slotsFilled = [...new Set(photosToday.map((p) => p.slot).filter((s): s is number => s !== null))];
  const present = attendanceToday.filter((a) => a.status === "PRESENT").length + 0.5 * attendanceToday.filter((a) => a.status === "HALF_DAY").length;
  const planned = planToday?.items.reduce((a, i) => a + i.manpowerPlanned, 0) ?? null;

  const jobsBehind: { id: string; jobNumber: string; name: string; bottleneck: string | null; overrun: number; percent: number; shouldBe: number }[] = [];
  const jobProgress: { id: string; jobNumber: string; name: string; percent: number; shouldBe: number }[] = [];
  const normFlags: { jobNumber: string; actual: number; norm: number }[] = [];
  for (const j of activeJobs) {
    const s = await jobStageSummary(j.id);
    const shouldBe = plannedPercentByDate(j.plannedStart, j.plannedEnd, today);
    jobProgress.push({ id: j.id, jobNumber: j.jobNumber, name: j.name, percent: s.overallPercent, shouldBe });
    // Behind = measurably short of where the plan says it should be, or a stage running over its days.
    if (s.overallPercent < shouldBe - 5 || s.bottleneck) {
      jobsBehind.push({
        id: j.id,
        jobNumber: j.jobNumber,
        name: j.name,
        bottleneck: s.bottleneck?.name ?? null,
        overrun: s.bottleneck?.daysOverrun ?? 0,
        percent: s.overallPercent,
        shouldBe,
      });
    }
    const n = await weldingNormForJob(j.id);
    if (n.over && n.actualKgPerMT !== null && n.normKgPerMT !== null) normFlags.push({ jobNumber: j.jobNumber, actual: Math.round(n.actualKgPerMT * 100) / 100, norm: n.normKgPerMT });
  }
  jobsBehind.sort((a, b) => b.shouldBe - b.percent - (a.shouldBe - a.percent));

  const lowStock = await prisma.consumableStock.findMany({
    where: { siteId, item: { active: true } },
    include: { item: { select: { name: true, unit: true, reorderLevel: true } } },
  });
  const lowItems = lowStock.filter((s) => Number(s.qtyOnHand) <= Number(s.item.reorderLevel)).map((s) => ({ name: s.item.name, qty: Number(s.qtyOnHand), unit: s.item.unit }));

  const machineCounts = Object.fromEntries(machines.map((m) => [m.status, m._count]));

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
    jobProgress,
    normFlags,
    lowItems,
    pendingCons: pendingCons.map((r) => ({ id: r.id, label: `${r.item.name} × ${Number(r.qty)} ${r.item.unit}`, sub: `${r.reason} — ${r.requestedBy.name}` })),
    pendingPetty: pendingPetty.map((r) => ({ id: r.id, amount: Number(r.amount), sub: `${r.reason} — ${r.requestedBy.name}`, urgency: r.urgency })),
    pendingItems: pendingItems.map((i) => ({ id: i.id, name: i.name, unit: i.unit, by: i.proposedBy?.name ?? "site" })),
    // One row per bill (all its waiting lines together), plus single entries without a bill.
    pendingExpenses: (() => {
      const rows: { id: string; endpoint: string; amount: number; label: string; sub: string; status: string }[] = [];
      const seen = new Set<string>();
      for (const e of pendingExpenses) {
        if (e.bill) {
          if (seen.has(e.bill.id)) continue;
          seen.add(e.bill.id);
          const lines = pendingExpenses.filter((x) => x.bill?.id === e.bill!.id);
          rows.push({
            id: e.bill.id,
            endpoint: `/api/bills/${e.bill.id}/decide`,
            amount: Number(lines.reduce((a, x) => a + Number(x.amount), 0).toFixed(2)),
            label: `${e.bill.payeeText ?? "Bill"} — ${lines.length} line${lines.length === 1 ? "" : "s"}`,
            sub: `${e.spentBy.name}${e.bill.billPhotoUrl ? "" : e.entryType === "PURCHASE" ? " · no bill photo" : ""}`,
            status: e.status,
          });
        } else {
          rows.push({ id: e.id, endpoint: `/api/expenses/${e.id}/decide`, amount: Number(e.amount), label: `${e.category.name}: ${e.description}`, sub: `${e.spentBy.name}${e.billPhotoUrl ? "" : e.entryType === "PURCHASE" ? " · no bill" : ""}`, status: e.status });
        }
      }
      return rows;
    })(),
    spendByCategory,
    monthTotal,
    cashHolders,
    cashOnStreet,
    pendingAdv: pendingAdv.map((r) => ({ id: r.id, amount: Number(r.amount), sub: `${r.worker.code} ${r.worker.name}: ${r.reason}` })),
    openIssues: openIssues.map((i) => ({ id: i.id, severity: i.severity, category: i.category, description: i.description.slice(0, 100), ageHours: Math.round((Date.now() - i.raisedAt.getTime()) / 3600000) })),
    machineCounts,
    pettyBalance: balance,
    pettyThreshold: Number(site.pettyCashThreshold),
    burnRate: burn,
  };
}
