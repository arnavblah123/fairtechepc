import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { Fulfilment } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api";
import { addDays, dateKeyToDate, formatINR, istDateKey, istHour, titleCase } from "./format";
import { jobStageSummary, plannedPercentByDate } from "./jobs";
import { weldingNormForJob } from "./consumables";
import { sumAmounts, toPaise, toRupees } from "./money";
import { ALREADY_DECIDED, decideAdvance, decideBill, decideConsumableRequest, decideExpenseLine, decideIndent, decideItem, decidePettyRequest, transitionIssue, type Actor } from "./decisions";
import { FEED_KEY_HEADER, FEED_VERSION, type AdminFeed, type FeedAction, type FeedActRequest, type FeedActResponse, type FeedActivity, type FeedApproval, type FeedFlag, type FeedKpi, type FeedMessage, type FeedReport } from "./feed/contract";

/**
 * Owner-dashboard feed: one JSON payload with everything across ALL sites that
 * is waiting for Arnav or wrong right now. Polled every minute, so every query
 * here is a flat findMany / groupBy / aggregate — no per-row round trips except
 * the per-job progress maths the dashboard itself already does.
 */

export const FEED_APP = "epc";
export const FEED_LABEL = "EPC Sites";

/* ------------------------------------------------------------------ */
/* Auth: shared secret header, constant-time compare                   */
/* ------------------------------------------------------------------ */

export function checkAdminKey(req: Request): Response | null {
  const expected = process.env.ADMIN_FEED_KEY;
  if (!expected) return NextResponse.json({ error: "ADMIN_FEED_KEY not configured" }, { status: 503 });
  const given = req.headers.get(FEED_KEY_HEADER) ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  const same = a.length === b.length && timingSafeEqual(a, b);
  if (!same) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

/* ------------------------------------------------------------------ */
/* Building the feed                                                   */
/* ------------------------------------------------------------------ */

const REJECT: FeedAction = { id: "reject", label: "Reject", tone: "danger", noteRequired: true };
const APPROVE: FeedAction = { id: "approve", label: "Approve", tone: "primary" };
const EXPENSE_ACTIONS: FeedAction[] = [APPROVE, { id: "query", label: "Query", tone: "neutral", noteRequired: true }, REJECT];
const CONSUMABLE_ACTIONS: FeedAction[] = [
  { id: "approve_purchase", label: "Approve — purchase desk", tone: "primary" },
  { id: "approve_factory", label: "Approve — from factory", tone: "primary" },
  { id: "approve_local", label: "Approve — buy locally", tone: "primary" },
  REJECT,
];
const ISSUE_RESOLVE: FeedAction = { id: "resolve", label: "Mark resolved", tone: "primary", noteRequired: true };
const ISSUE_ACK: FeedAction = { id: "acknowledge", label: "Acknowledge", tone: "neutral" };

const ESCALATE_HOURS = 48;

function rs(v: unknown): number {
  return toRupees(toPaise(v));
}

function who(u: { name: string } | null | undefined, fallback = "site") {
  return u?.name ?? fallback;
}

export async function buildAdminFeed(): Promise<AdminFeed> {
  const now = new Date();
  const today = istDateKey(now);
  const yesterday = addDays(today, -1);
  const todayD = dateKeyToDate(today);
  const yesterdayD = dateKeyToDate(yesterday);
  const monthStart = dateKeyToDate(today.slice(0, 8) + "01");
  const dayAgo = new Date(now.getTime() - 24 * 3600000);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const [
    sites,
    pendingAdv,
    pendingExpenses,
    pendingPetty,
    pendingCons,
    pendingItems,
    openIssues,
    openTickets,
    activeJobs,
    stock,
    dprs,
    holidaysY,
    attendanceToday,
    planToday,
    cashSum,
    monthSpend,
    pettyGroups,
    auditRows,
    recentIssues,
  ] = await Promise.all([
    prisma.site.findMany({ where: { active: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, code: true, pettyCashThreshold: true, dprCutoffHour: true } }),
    prisma.advance.findMany({
      where: { status: "PENDING", voidedAt: null },
      orderBy: { requestedAt: "asc" },
      include: { worker: { select: { code: true, name: true } }, requestedBy: { select: { name: true } }, site: { select: { name: true } } },
    }),
    prisma.expense.findMany({
      where: { status: { in: ["PENDING", "QUERIED"] }, voidedAt: null },
      orderBy: { date: "asc" },
      include: { category: { select: { name: true } }, spentBy: { select: { name: true } }, site: { select: { name: true } }, bill: { select: { id: true, payeeText: true, billPhotoUrl: true, createdAt: true } } },
    }),
    prisma.pettyCashRequest.findMany({
      where: { status: "PENDING", voidedAt: null },
      orderBy: { requestedAt: "asc" },
      include: { requestedBy: { select: { name: true } }, site: { select: { name: true } } },
    }),
    prisma.consumableRequest.findMany({
      where: { status: "PENDING", voidedAt: null },
      orderBy: { requestedAt: "asc" },
      include: { item: { select: { name: true, unit: true } }, requestedBy: { select: { name: true } }, site: { select: { name: true } }, indent: { select: { id: true, indentNo: true, reason: true, neededBy: true, requestedAt: true, requestedBy: { select: { name: true } } } } },
    }),
    prisma.consumableItem.findMany({ where: { approved: false, active: true }, orderBy: { createdAt: "asc" }, include: { proposedBy: { select: { name: true } } } }),
    prisma.issue.findMany({
      where: { status: { not: "RESOLVED" }, voidedAt: null },
      orderBy: { raisedAt: "asc" },
      include: { site: { select: { name: true } }, job: { select: { jobNumber: true } } },
    }),
    prisma.machineTicket.findMany({
      where: { status: "OPEN", voidedAt: null },
      orderBy: { createdAt: "asc" },
      include: { machine: { select: { machineNumber: true, type: true } }, site: { select: { name: true } } },
    }),
    prisma.job.findMany({ where: { voidedAt: null, status: "ACTIVE" }, select: { id: true, jobNumber: true, name: true, plannedStart: true, plannedEnd: true, siteId: true } }),
    prisma.consumableStock.findMany({ where: { item: { active: true } }, select: { siteId: true, qtyOnHand: true, item: { select: { reorderLevel: true } } } }),
    prisma.dPR.findMany({ where: { date: { in: [yesterdayD, todayD] } }, select: { siteId: true, date: true, status: true } }),
    prisma.holiday.findMany({ where: { date: yesterdayD }, select: { siteId: true } }),
    prisma.attendance.groupBy({ by: ["status"], where: { date: todayD }, _count: true }),
    prisma.dailyPlanItem.aggregate({ where: { plan: { date: todayD } }, _sum: { manpowerPlanned: true } }),
    // Cash with people = sum of the append-only ledger (every holder's inHand added up).
    prisma.cashLedger.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { status: "APPROVED", voidedAt: null, date: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.pettyCashTxn.groupBy({ by: ["siteId", "type"], where: { voidedAt: null }, _sum: { amount: true } }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: dayAgo } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { user: { select: { name: true } }, site: { select: { code: true } } },
    }),
    prisma.issue.findMany({
      where: { raisedAt: { gte: weekAgo }, voidedAt: null },
      orderBy: { raisedAt: "desc" },
      take: 30,
      include: { raisedBy: { select: { name: true } }, site: { select: { name: true } } },
    }),
  ]);

  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const siteOf = (id: string) => siteName.get(id) ?? "—";

  /* ---------------- approvals ---------------- */
  const approvals: FeedApproval[] = [];

  for (const r of pendingAdv) {
    approvals.push({
      id: `advance:${r.id}`,
      kind: "advance",
      title: `Advance ${formatINR(r.amount)} — ${r.worker.name} (${r.worker.code})`,
      detail: `Reason: ${r.reason}`,
      amount: rs(r.amount),
      requestedBy: r.requestedBy.name,
      requestedAt: r.requestedAt.toISOString(),
      unit: r.site.name,
      href: "/advances",
      actions: [APPROVE, REJECT],
    });
  }

  // One approval per bill (all its waiting lines together), plus single entries without a bill.
  const billsSeen = new Set<string>();
  for (const e of pendingExpenses) {
    if (e.bill) {
      if (billsSeen.has(e.bill.id)) continue;
      billsSeen.add(e.bill.id);
      const lines = pendingExpenses.filter((x) => x.bill?.id === e.bill!.id);
      const queried = lines.some((l) => l.status === "QUERIED");
      approvals.push({
        id: `bill:${e.bill.id}`,
        kind: "bill",
        title: `${formatINR(sumAmounts(lines.map((l) => l.amount)))} — ${e.bill.payeeText ?? "Bill"} (${lines.length} line${lines.length === 1 ? "" : "s"})${queried ? " (queried)" : ""}`,
        detail: lines.map((l) => `${l.category.name}: ${l.description}`).join(" · ") + (e.bill.billPhotoUrl ? "" : " · no bill photo"),
        amount: sumAmounts(lines.map((l) => l.amount)),
        requestedBy: e.spentBy.name,
        requestedAt: e.bill.createdAt.toISOString(),
        unit: e.site.name,
        href: "/expenses?status=PENDING",
        actions: EXPENSE_ACTIONS,
      });
    } else {
      approvals.push({
        id: `expense:${e.id}`,
        kind: "expense",
        title: `${formatINR(e.amount)} — ${e.category.name}: ${e.description}${e.status === "QUERIED" ? " (queried)" : ""}`,
        detail: `${e.spentBy.name}${e.payeeText ? ` · paid to ${e.payeeText}` : ""}${e.billPhotoUrl ? "" : e.entryType === "PURCHASE" ? " · no bill" : ""}${e.status === "QUERIED" && e.decisionNote ? ` · query: ${e.decisionNote}` : ""}`,
        amount: rs(e.amount),
        requestedBy: e.spentBy.name,
        requestedAt: e.createdAt.toISOString(),
        unit: e.site.name,
        href: "/expenses?status=PENDING",
        actions: EXPENSE_ACTIONS,
      });
    }
  }

  for (const r of pendingPetty) {
    approvals.push({
      id: `petty_request:${r.id}`,
      kind: "petty_request",
      title: `Petty cash ${formatINR(r.amount)}${r.urgency !== "NORMAL" ? ` · ${titleCase(r.urgency)}` : ""}`,
      detail: `Reason: ${r.reason}`,
      amount: rs(r.amount),
      requestedBy: r.requestedBy.name,
      requestedAt: r.requestedAt.toISOString(),
      unit: r.site.name,
      href: "/petty-cash",
      actions: [APPROVE, REJECT],
    });
  }

  // Lines raised together as an indent are decided together, like the app's one-tap indent approval.
  const indentsSeen = new Set<string>();
  for (const r of pendingCons) {
    if (r.indent) {
      if (indentsSeen.has(r.indent.id)) continue;
      indentsSeen.add(r.indent.id);
      const lines = pendingCons.filter((x) => x.indent?.id === r.indent!.id);
      approvals.push({
        id: `indent:${r.indent.id}`,
        kind: "indent",
        title: `Indent ${r.indent.indentNo} — ${lines.length} item${lines.length === 1 ? "" : "s"}`,
        detail: `${lines.map((l) => `${l.item.name} × ${Number(l.qty)} ${l.item.unit}`).join(", ")} · ${r.indent.reason} · needed by ${r.indent.neededBy.toISOString().slice(0, 10)}`,
        requestedBy: r.indent.requestedBy.name,
        requestedAt: r.indent.requestedAt.toISOString(),
        unit: r.site.name,
        href: "/consumables/requests",
        actions: CONSUMABLE_ACTIONS,
      });
    } else {
      approvals.push({
        id: `consumable_request:${r.id}`,
        kind: "consumable_request",
        title: `${r.item.name} × ${Number(r.qty)} ${r.item.unit}`,
        detail: `${r.reason} · needed by ${r.neededBy.toISOString().slice(0, 10)}`,
        requestedBy: r.requestedBy.name,
        requestedAt: r.requestedAt.toISOString(),
        unit: r.site.name,
        href: "/consumables/requests",
        actions: CONSUMABLE_ACTIONS,
      });
    }
  }

  for (const i of pendingItems) {
    approvals.push({
      id: `item_proposal:${i.id}`,
      kind: "item_proposal",
      title: `New item: ${i.name} (${i.unit})`,
      detail: `${titleCase(i.category)} · added by ${who(i.proposedBy)} while ordering`,
      requestedBy: who(i.proposedBy),
      requestedAt: i.createdAt.toISOString(),
      href: "/admin/items",
      actions: [{ ...APPROVE, label: "Keep in master" }, REJECT],
    });
  }

  /* ---------------- flags ---------------- */
  const flags: FeedFlag[] = [];

  for (const i of openIssues) {
    const ageHours = Math.round((now.getTime() - i.raisedAt.getTime()) / 3600000);
    const escalated = ageHours > ESCALATE_HOURS;
    const critical = i.severity === "WORK_STOPPED" || i.severity === "HIGH";
    flags.push({
      id: `issue:${i.id}`,
      severity: critical ? "critical" : "warning",
      kind: "issue_open",
      title: `${i.severity === "WORK_STOPPED" ? "WORK STOPPED · " : ""}${titleCase(i.category)}${i.job ? ` — ${i.job.jobNumber}` : ""}${escalated ? " (escalated)" : ""}`,
      detail: `${i.description.slice(0, 160)} · ${titleCase(i.severity)} · ${titleCase(i.status)} · ${ageHours}h old${i.neededFromHO ? ` · needs from HO: ${i.neededFromHO}` : ""}`,
      since: i.raisedAt.toISOString(),
      unit: i.site.name,
      href: `/issues/${i.id}`,
      actions: i.status === "OPEN" ? [ISSUE_ACK, ISSUE_RESOLVE] : [ISSUE_RESOLVE],
    });
  }

  // Jobs behind plan and welding over norm: same maths as the site dashboard.
  let jobsBehindCount = 0;
  for (const j of activeJobs) {
    const [s, n] = await Promise.all([jobStageSummary(j.id), weldingNormForJob(j.id)]);
    const shouldBe = plannedPercentByDate(j.plannedStart, j.plannedEnd, today);
    if (s.overallPercent < shouldBe - 5 || s.bottleneck) {
      jobsBehindCount++;
      const gap = Math.max(0, shouldBe - s.overallPercent);
      flags.push({
        id: `job_behind:${j.id}`,
        severity: "warning",
        kind: "job_behind",
        title: `${j.jobNumber} · ${j.name} — ${gap}% behind plan`,
        detail: s.bottleneck ? `Bottleneck: ${s.bottleneck.name} · ${s.bottleneck.daysOverrun} days over · ${s.overallPercent}% done, should be ${shouldBe}%` : `${s.overallPercent}% done, should be ${shouldBe}%`,
        unit: siteOf(j.siteId),
        href: `/jobs/${j.id}`,
      });
    }
    if (n.over && n.actualKgPerMT !== null && n.normKgPerMT !== null) {
      flags.push({
        id: `welding_norm:${j.id}`,
        severity: "info",
        kind: "welding_over_norm",
        title: `${j.jobNumber}: welding ${Math.round(n.actualKgPerMT * 100) / 100} kg/MT vs norm ${n.normKgPerMT}`,
        detail: `${Math.round(n.kgUsed)} kg consumed over ${Math.round(n.mtDone * 100) / 100} MT fabricated`,
        unit: siteOf(j.siteId),
        href: `/jobs/${j.id}`,
      });
    }
  }

  // Low stock, rolled up per site.
  const lowBySite = new Map<string, number>();
  for (const s of stock) {
    if (Number(s.qtyOnHand) <= Number(s.item.reorderLevel)) lowBySite.set(s.siteId, (lowBySite.get(s.siteId) ?? 0) + 1);
  }
  for (const [siteId, count] of lowBySite) {
    flags.push({ id: `low_stock:${siteId}`, severity: "warning", kind: "low_stock", title: `${count} item${count === 1 ? "" : "s"} at or below reorder level`, count, unit: siteOf(siteId), href: "/consumables" });
  }

  // DPR missing: yesterday was a working day with no submitted DPR, or today's is still open after the cutoff.
  const holidaySites = new Set(holidaysY.map((h) => h.siteId));
  const dprStatus = (siteId: string, d: Date) => dprs.find((x) => x.siteId === siteId && x.date.getTime() === d.getTime())?.status;
  const hour = istHour(now);
  for (const s of sites) {
    if (!holidaySites.has(s.id) && dprStatus(s.id, yesterdayD) !== "SUBMITTED") {
      flags.push({ id: `dpr_missing:${s.id}:${yesterday}`, severity: "warning", kind: "dpr_missing", title: `DPR missing for ${yesterday}`, since: dateKeyToDate(today).toISOString(), unit: s.name, href: `/dpr?date=${yesterday}` });
    }
    if (hour >= s.dprCutoffHour && dprStatus(s.id, todayD) !== "SUBMITTED") {
      flags.push({ id: `dpr_missing:${s.id}:${today}`, severity: "warning", kind: "dpr_missing", title: `Today's DPR not submitted (past ${s.dprCutoffHour}:00)`, unit: s.name, href: "/dpr" });
    }
  }

  // Petty cash wallet per site vs its threshold.
  const pettyBySite = new Map<string, number>();
  for (const g of pettyGroups) {
    const p = toPaise(g._sum.amount ?? 0);
    const signed = g.type === "EXPENSE" || g.type === "RETURN" ? -p : p;
    pettyBySite.set(g.siteId, (pettyBySite.get(g.siteId) ?? 0) + signed);
  }
  let pettyTotalPaise = 0;
  for (const s of sites) {
    const bal = pettyBySite.get(s.id) ?? 0;
    pettyTotalPaise += bal;
    const threshold = toPaise(s.pettyCashThreshold);
    if (bal < threshold) {
      flags.push({ id: `petty_low:${s.id}`, severity: "warning", kind: "petty_cash_low", title: `Site cash ${formatINR(toRupees(bal))} below ${formatINR(s.pettyCashThreshold)} threshold`, unit: s.name, href: "/cash" });
    }
  }

  for (const t of openTickets) {
    flags.push({
      id: `machine_ticket:${t.id}`,
      severity: "info",
      kind: "machine_ticket_open",
      title: `${t.machine.machineNumber} ${titleCase(t.machine.type)}: ${t.problem.slice(0, 100)}`,
      since: t.createdAt.toISOString(),
      unit: t.site.name,
      href: `/machines/${t.machineId}`,
    });
  }

  /* ---------------- kpis ---------------- */
  const count = (st: string) => attendanceToday.find((a) => a.status === st)?._count ?? 0;
  const present = count("PRESENT") + 0.5 * count("HALF_DAY");
  const planned = planToday._sum.manpowerPlanned;
  const cashOnStreet = rs(cashSum._sum.amount ?? 0);
  const monthTotal = rs(monthSpend._sum.amount ?? 0);
  const pettyTotal = toRupees(pettyTotalPaise);
  const criticalIssues = openIssues.filter((i) => i.severity === "WORK_STOPPED").length;

  const kpis: FeedKpi[] = [
    { key: "workers_present", label: "Workers present today", value: present, hint: planned != null ? `of ${planned} planned` : "no plan submitted", tone: planned != null && present < planned ? "warn" : "neutral", href: "/attendance" },
    { key: "cash_on_street", label: "Cash with people", value: cashOnStreet, unit: "₹", tone: "neutral", hint: "sum of every holder's cash-in-hand", href: "/cash" },
    { key: "month_spend", label: "Spend this month", value: monthTotal, unit: "₹", tone: "neutral", hint: "approved expenses", href: "/expenses" },
    { key: "petty_balance", label: "Site cash balance", value: pettyTotal, unit: "₹", tone: sites.some((s) => (pettyBySite.get(s.id) ?? 0) < toPaise(s.pettyCashThreshold)) ? "warn" : "good", hint: "all sites", href: "/petty-cash" },
    { key: "open_issues", label: "Open issues", value: openIssues.length, tone: criticalIssues ? "bad" : openIssues.length ? "warn" : "good", hint: criticalIssues ? `${criticalIssues} work stopped` : undefined, href: "/issues" },
    { key: "jobs_behind", label: "Jobs behind plan", value: jobsBehindCount, tone: jobsBehindCount ? "warn" : "good", hint: `of ${activeJobs.length} active`, href: "/jobs" },
    { key: "pending_approvals", label: "Pending approvals", value: approvals.length, tone: approvals.length ? "warn" : "good", href: "/" },
    { key: "active_sites", label: "Active sites", value: sites.length, tone: "neutral", href: "/admin/sites" },
  ];

  /* ---------------- activity ---------------- */
  const activity: FeedActivity[] = auditRows.map((l) => ({
    id: `audit:${l.id}`,
    at: l.createdAt.toISOString(),
    actor: l.user.name,
    text: `${titleCase(l.action)} ${entityLabel(l.entity)}${l.entityId ? ` ${l.entityId.slice(-6)}` : ""}${l.site ? ` · ${l.site.code}` : ""}`,
    href: entityHref(l.entity, l.entityId),
  }));

  /* ---------------- messages ---------------- */
  const messages: FeedMessage[] = recentIssues.map((i) => ({
    id: `issue:${i.id}`,
    at: i.raisedAt.toISOString(),
    from: i.raisedBy.name,
    channel: "issue",
    text: `[${i.site.name}] ${titleCase(i.severity)} · ${titleCase(i.category)}: ${i.description.slice(0, 200)}`,
    href: `/issues/${i.id}`,
    unread: i.status !== "RESOLVED",
  }));

  /* ---------------- reports ---------------- */
  const firstSite = sites[0]?.id;
  const q = firstSite ? `?siteId=${firstSite}` : "";
  const reports: FeedReport[] = [
    { id: "dashboard", title: "Exception dashboard", href: "/", period: "today" },
    { id: "audit", title: "Audit log", href: "/admin/audit" },
    { id: "cash", title: "Cash in hand by person", href: "/cash", period: "now" },
    { id: "wages", title: "Wage sheets", href: "/wages" },
    { id: "expenses", title: "Expenses & bills", href: "/expenses", period: "this month" },
    { id: "petty", title: "Site cash book", href: "/petty-cash" },
    { id: "dpr", title: "Daily progress report", href: "/dpr", period: "today" },
    { id: "csv_expenses", title: "Expenses CSV", href: `/api/expenses/export${q}`, description: "Add &from=YYYY-MM-DD&to=YYYY-MM-DD to narrow" },
    { id: "csv_petty", title: "Site cash book CSV", href: `/api/petty/export${q}` },
    { id: "csv_jobs", title: "Jobs & stages CSV", href: `/api/jobs/export${q}` },
    { id: "csv_consumables", title: "Consumables CSV", href: `/api/consumables/export${q}` },
    { id: "csv_attendance", title: "Attendance CSV", href: `/api/attendance/export${q}${q ? "&" : "?"}from=${today.slice(0, 8)}01&to=${today}`, period: "this month" },
    { id: "csv_wages", title: "Wage sheet CSV", href: `/api/wages/export${q}${q ? "&" : "?"}period=MONTHLY&start=${today.slice(0, 8)}01`, period: "this month" },
    { id: "csv_workers", title: "Labour master CSV", href: `/api/workers/export${q}` },
    { id: "csv_users", title: "Users CSV", href: "/api/users/export" },
  ];

  return {
    version: FEED_VERSION,
    app: FEED_APP,
    label: FEED_LABEL,
    generatedAt: now.toISOString(),
    units: sites.map((s) => s.name),
    kpis,
    approvals,
    flags,
    activity,
    messages,
    reports,
  };
}

function entityLabel(entity: string) {
  return entity.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function entityHref(entity: string, id: string | null): string {
  switch (entity) {
    case "Advance": return "/advances";
    case "Expense":
    case "Bill": return "/expenses";
    case "Issue": return id ? `/issues/${id}` : "/issues";
    case "Job":
    case "Stage":
    case "StageProgress": return entity === "Job" && id ? `/jobs/${id}` : "/jobs";
    case "ConsumableRequest":
    case "MaterialIndent": return "/consumables/requests";
    case "ConsumableItem": return "/admin/items";
    case "PettyCashRequest":
    case "PettyCashTxn": return "/petty-cash";
    case "CashLedger": return "/cash";
    case "Machine":
    case "MachineTicket":
    case "MachineDispatch": return "/machines";
    case "Attendance": return "/attendance";
    case "Worker": return "/workers";
    case "WageSheet": return "/wages";
    case "DPR": return "/dpr";
    case "User": return "/admin/users";
    default: return "/admin/audit";
  }
}

/* ------------------------------------------------------------------ */
/* Acting on an approval or a flag                                     */
/* ------------------------------------------------------------------ */

/** The owner's account inside this app: match on username (email or its local part) or name, else the first superadmin. */
export async function resolveOwner(actor: { name?: string; email?: string }) {
  const email = (actor.email ?? "").trim().toLowerCase();
  const local = email.split("@")[0] ?? "";
  const candidates: string[] = [email, local].filter(Boolean);
  if (candidates.length) {
    const byUsername = await prisma.user.findFirst({ where: { role: "SUPERADMIN", active: true, username: { in: candidates } } });
    if (byUsername) return byUsername;
  }
  if (actor.name?.trim()) {
    const byName = await prisma.user.findFirst({ where: { role: "SUPERADMIN", active: true, name: { equals: actor.name.trim(), mode: "insensitive" } } });
    if (byName) return byName;
  }
  return prisma.user.findFirst({ where: { role: "SUPERADMIN", active: true }, orderBy: { createdAt: "asc" } });
}

export class FeedActError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const FULFILMENT_BY_ACTION: Record<string, Fulfilment> = {
  approve: "PURCHASE_ORDER",
  approve_purchase: "PURCHASE_ORDER",
  approve_factory: "FROM_FACTORY",
  approve_local: "LOCAL_PURCHASE",
};

function approveOrReject(actionId: string): "APPROVED" | "REJECTED" {
  if (actionId === "approve") return "APPROVED";
  if (actionId === "reject") return "REJECTED";
  throw new FeedActError(400, `Unknown action "${actionId}"`);
}

function requireNote(note: string | undefined, what: string): string {
  const n = (note ?? "").trim();
  if (!n) throw new FeedActError(400, `${what} needs a note`);
  return n;
}

/**
 * Runs the same core function the app's own button calls. Business outcomes
 * ("Already decided") come back as ok:false; bad input throws FeedActError.
 */
export async function performFeedAction(body: FeedActRequest, actor: Actor): Promise<FeedActResponse> {
  const ref = body.approvalId ?? body.flagId;
  if (!ref || typeof ref !== "string") throw new FeedActError(400, "approvalId or flagId is required");
  const actionId = String(body.actionId ?? "");
  const sep = ref.indexOf(":");
  if (sep <= 0) throw new FeedActError(404, "Not found");
  const kind = ref.slice(0, sep);
  const id = ref.slice(sep + 1);
  const note = (body.note ?? "").trim() || null;

  try {
    switch (kind) {
      case "advance": {
        const d = approveOrReject(actionId);
        if (d === "REJECTED") requireNote(body.note, "Rejecting");
        const r = await decideAdvance(id, d, note, actor);
        return { ok: true, message: d === "APPROVED" ? `Advance ${formatINR(r.amount)} approved.` : "Advance rejected." };
      }
      case "petty_request": {
        const d = approveOrReject(actionId);
        if (d === "REJECTED") requireNote(body.note, "Rejecting");
        const r = await decidePettyRequest(id, d, note, actor);
        return { ok: true, message: d === "APPROVED" ? `Petty cash ${formatINR(r.amount)} approved.` : "Petty cash request rejected." };
      }
      case "expense":
      case "bill": {
        const d = actionId === "approve" ? "APPROVED" : actionId === "query" ? "QUERIED" : actionId === "reject" ? "REJECTED" : null;
        if (!d) throw new FeedActError(400, `Unknown action "${actionId}"`);
        if (d !== "APPROVED") requireNote(body.note, d === "QUERIED" ? "Querying" : "Rejecting");
        if (kind === "bill") {
          const r = await decideBill(id, d, note, actor);
          return { ok: true, message: `Bill ${d.toLowerCase()} (${r.decided} line${r.decided === 1 ? "" : "s"}).` };
        }
        await decideExpenseLine(id, d, note, actor);
        return { ok: true, message: `Expense ${d.toLowerCase()}.` };
      }
      case "consumable_request":
      case "indent": {
        const fulfilment = FULFILMENT_BY_ACTION[actionId];
        const d: "APPROVED" | "REJECTED" = fulfilment ? "APPROVED" : actionId === "reject" ? "REJECTED" : approveOrReject(actionId);
        if (d === "REJECTED") requireNote(body.note, "Rejecting");
        if (kind === "indent") {
          const r = await decideIndent(id, d, fulfilment ?? null, note, actor);
          return { ok: true, message: d === "APPROVED" ? `Indent approved (${r.decided} line${r.decided === 1 ? "" : "s"}, ${titleCase(fulfilment!)}).` : "Indent rejected." };
        }
        await decideConsumableRequest(id, d, fulfilment ?? null, note, actor);
        return { ok: true, message: d === "APPROVED" ? `Request approved (${titleCase(fulfilment!)}).` : "Request rejected." };
      }
      case "item_proposal": {
        const d = approveOrReject(actionId);
        if (d === "REJECTED") requireNote(body.note, "Rejecting");
        const item = await prisma.consumableItem.findUnique({ where: { id }, select: { approved: true, active: true } });
        if (!item) throw new FeedActError(404, "Not found");
        if (item.approved || !item.active) return { ok: false, error: ALREADY_DECIDED };
        await decideItem(id, d, note, actor);
        return { ok: true, message: d === "APPROVED" ? "Item kept in the master." : "Item rejected." };
      }
      case "issue": {
        const action = actionId === "resolve" ? "RESOLVE" : actionId === "acknowledge" ? "ACKNOWLEDGE" : actionId === "in_progress" ? "IN_PROGRESS" : null;
        if (!action) throw new FeedActError(400, `Unknown action "${actionId}"`);
        if (action === "RESOLVE") requireNote(body.note, "Resolving");
        const before = await prisma.issue.findFirst({ where: { id, voidedAt: null } });
        if (!before) throw new FeedActError(404, "Not found");
        if (before.status === "RESOLVED") return { ok: false, error: ALREADY_DECIDED };
        if (action === "ACKNOWLEDGE" && before.status !== "OPEN") return { ok: false, error: ALREADY_DECIDED };
        await transitionIssue(before, action, note, actor);
        return { ok: true, message: action === "RESOLVE" ? "Issue marked resolved." : action === "ACKNOWLEDGE" ? "Issue acknowledged." : "Issue marked in progress." };
      }
      default:
        throw new FeedActError(404, "Not found");
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) throw new FeedActError(404, "Not found");
      if (err.status === 400 && /already|nothing left to decide/i.test(err.message)) return { ok: false, error: ALREADY_DECIDED };
      throw new FeedActError(err.status, err.message);
    }
    throw err;
  }
}
