import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, Stat } from "@/components/ui/Card";
import { Bi } from "@/components/ui/Bi";
import { LinkButton } from "@/components/ui/Button";
import { formatDate, formatINR, formatNum, istDateKey, dateKeyToDate, dateToKey, titleCase } from "@/lib/format";
import { siteDashboard } from "@/lib/dashboard";
import { balanceOf, pendingSpendOf } from "@/lib/ledger";
import { siteWorkersForDate, stageRowsForJob } from "@/lib/progress-board";
import { ProgressEditor } from "./jobs/[id]/progress/ProgressEditor";
import { ProgressChart } from "@/components/dashboard/ProgressChart";
import { ApprovalRow } from "@/components/dashboard/ApprovalRow";
import { PHOTO_SLOTS } from "@/lib/slots";

export default async function HomePage() {
  const user = (await getSessionUser())!;
  if (user.role === "SUPERADMIN") return <AdminDashboard />;
  if (user.role === "PURCHASE") return <PurchaseHome />;
  return <SiteHome />;
}

/* ------------------------------------------------------------------ */
/* Purchase desk (Pune): what needs ordering, what is on the way       */
/* ------------------------------------------------------------------ */
async function PurchaseHome() {
  const user = (await getSessionUser())!;
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site set up yet." />;
  const [toOrder, ordered, inTransit] = await Promise.all([
    prisma.consumableRequest.findMany({
      where: { siteId: site.id, status: "APPROVED", fulfilment: { not: "LOCAL_PURCHASE" }, voidedAt: null },
      orderBy: { neededBy: "asc" },
      include: { item: { select: { name: true, unit: true } } },
    }),
    prisma.consumableRequest.findMany({
      where: { siteId: site.id, status: "ORDERED", voidedAt: null },
      orderBy: { expectedDate: "asc" },
      include: { item: { select: { name: true, unit: true } }, dispatches: { where: { voidedAt: null }, select: { receivedAt: true } } },
    }),
    prisma.consumableDispatch.count({ where: { siteId: site.id, receivedAt: null, voidedAt: null } }),
  ]);
  const today = istDateKey();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Purchase desk · {formatDate(today)}</h1>
        <p className="text-sm text-slate-500">{site.name}, {site.city}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="To order" hi="ऑर्डर करना है" value={toOrder.length} tone={toOrder.length ? "red" : "green"} />
        <Stat label="In transit" hi="रास्ते में" value={inTransit} tone="blue" />
      </div>
      <Card title="Approved — waiting for your order" hi="ऑर्डर बाकी" action={<Link href="/consumables/requests" className="text-sm font-semibold text-brand">Open →</Link>}>
        {toOrder.length === 0 ? (
          <p className="text-sm text-green-700">Nothing pending 🎉</p>
        ) : (
          <ul className="divide-y text-sm">
            {toOrder.map((r) => {
              const late = dateToKey(r.neededBy) < today;
              return (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span className="min-w-0 flex-1 truncate">{r.item.name} · {formatNum(r.qty)} {r.item.unit}</span>
                  <span className={`shrink-0 text-xs ${late ? "font-bold text-red-600" : "text-slate-500"}`}>needed {formatDate(r.neededBy)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card title="Ordered" hi="ऑर्डर हो चुका">
        {ordered.length === 0 ? (
          <p className="text-sm text-slate-500">No open orders.</p>
        ) : (
          <ul className="divide-y text-sm">
            {ordered.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="min-w-0 flex-1 truncate">{r.item.name} · {formatNum(r.qty)} {r.item.unit}</span>
                  <Badge tone={r.dispatches.length ? "blue" : "amber"}>{r.dispatches.length ? "dispatched" : "to dispatch"}</Badge>
                </div>
                <div className="text-xs text-slate-500">
                  {r.vendorName}{r.poNumber ? ` · PO ${r.poNumber}` : ""}{r.expectedDate ? ` · due ${formatDate(r.expectedDate)}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <LinkButton href="/consumables/requests" variant="primary"><Bi en="Requests" hi="रिक्वेस्ट" /></LinkButton>
        <LinkButton href="/consumables" variant="outline"><Bi en="Site stock" hi="स्टॉक" /></LinkButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Site roles: quick actions + today's status                          */
/* ------------------------------------------------------------------ */
async function SiteHome() {
  const user = (await getSessionUser())!;
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="Your account is not attached to a site. Ask Arnav." />;
  const today = istDateKey();
  const dateObj = dateKeyToDate(today);
  const [workers, present, muster, slots, plan, dpr, openIssues] = await Promise.all([
    prisma.worker.count({ where: { siteId: site.id, active: true } }),
    prisma.attendance.count({ where: { siteId: site.id, date: dateObj, status: { in: ["PRESENT", "HALF_DAY"] } } }),
    prisma.sitePhoto.count({ where: { siteId: site.id, kind: "MUSTER", date: dateObj, voidedAt: null } }),
    prisma.sitePhoto.findMany({ where: { siteId: site.id, kind: "DAILY_SLOT", date: dateObj, voidedAt: null }, select: { slot: true } }),
    prisma.dailyPlan.findUnique({ where: { siteId_date: { siteId: site.id, date: dateObj } }, select: { id: true } }),
    prisma.dPR.findUnique({ where: { siteId_date: { siteId: site.id, date: dateObj } }, select: { status: true } }),
    prisma.issue.count({ where: { siteId: site.id, status: { not: "RESOLVED" }, voidedAt: null } }),
  ]);
  const filled = new Set(slots.map((s) => s.slot));
  const canMark = can(user.role, "attendance.mark");
  const [myBalance, myPending] = await Promise.all([balanceOf(user.id), pendingSpendOf(user.id)]);

  // Stage tracking lives on the home page: every active job, every stage, today's crew.
  const canTrack = can(user.role, "stage.progress");
  const activeJobs = canTrack
    ? await prisma.job.findMany({ where: { siteId: site.id, voidedAt: null, status: "ACTIVE" }, orderBy: { jobNumber: "asc" }, select: { id: true, jobNumber: true, name: true } })
    : [];
  const crew = canTrack ? await siteWorkersForDate(site.id, today) : null;
  const boards = canTrack ? await Promise.all(activeJobs.map(async (j) => ({ job: j, stages: await stageRowsForJob(j.id, today, today) }))) : [];
  const presentIds = new Set(
    (await prisma.attendance.findMany({ where: { siteId: site.id, date: dateObj, status: { in: ["PRESENT", "HALF_DAY"] } }, select: { workerId: true } })).map((a) => a.workerId),
  );
  const unassigned = crew ? [...presentIds].filter((id) => !crew.assignedWorkerIds.has(id)).length : 0;
  const steps: { href: string; en: string; hi: string; done: boolean }[] = [
    { href: "/attendance", en: "Muster photo + attendance", hi: "मस्टर फोटो और हाज़िरी", done: muster > 0 && present > 0 },
    { href: "/plan", en: "Daily plan", hi: "दैनिक योजना", done: !!plan },
    { href: "/photos", en: `Site photos (${filled.size}/5)`, hi: "साइट फोटो", done: filled.size >= 5 },
    ...(can(user.role, "dpr.submit") ? [{ href: "/dpr", en: "Submit DPR before 8 PM", hi: "8 बजे से पहले डीपीआर", done: dpr?.status === "SUBMITTED" }] : []),
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold"><Bi en={`Today ${formatDate(today)}`} hi="आज" inline /></h1>
        <p className="text-sm text-slate-500">{site.name}, {site.city}</p>
      </div>
      <div className="mb-1 flex gap-1">
        {PHOTO_SLOTS.map((s) => (
          <span key={s.slot} className={`flex-1 rounded-lg py-1 text-center text-[10px] font-bold text-white ${filled.has(s.slot) ? "bg-green-600" : "bg-red-500"}`}>{s.label}</span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Present today" hi="आज हाज़िर" value={`${present} / ${workers}`} tone={present ? "green" : "amber"} />
        <Stat label="Open issues" hi="खुली समस्याएँ" value={openIssues} tone={openIssues ? "red" : "green"} />
      </div>
      {can(user.role, "expense.create") && (
        <Link href="/expenses" className="block">
          <Card>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">My cash in hand</div>
                <div className={`text-2xl font-bold ${myBalance.inHand < 0 ? "text-red-600" : ""}`}>{formatINR(myBalance.inHand)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Waiting approval</div>
                <div className="text-2xl font-bold text-amber-600">{formatINR(myPending)}</div>
              </div>
            </div>
          </Card>
        </Link>
      )}
      {/* The four things a supervisor needs to start without hunting through menus. */}
      <Card title="Need something?" hi="कुछ चाहिए?">
        <div className="grid grid-cols-2 gap-2">
          {can(user.role, "consumable.request") && (
            <Link href="/consumables/requests?new=1" className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-xl bg-brand px-2 text-center text-white">
              <span className="text-2xl leading-none">📦</span>
              <Bi en="Ask for material" hi="सामान माँगें" className="text-sm font-semibold leading-tight" />
            </Link>
          )}
          {can(user.role, "machine.ticket") && (
            <Link href="/machines/repair" className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-xl bg-slate-800 px-2 text-center text-white">
              <span className="text-2xl leading-none">🔧</span>
              <Bi en="Machine repair" hi="मशीन मरम्मत" className="text-sm font-semibold leading-tight" />
            </Link>
          )}
          {can(user.role, "expense.create") && (
            <Link href="/expenses/new" className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-xl bg-green-700 px-2 text-center text-white">
              <span className="text-2xl leading-none">💵</span>
              <Bi en="Add expense" hi="खर्च भरें" className="text-sm font-semibold leading-tight" />
            </Link>
          )}
          {can(user.role, "issue.raise") && (
            <Link href="/issues/new" className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-xl bg-red-600 px-2 text-center text-white">
              <span className="text-2xl leading-none">⚠</span>
              <Bi en="Raise issue" hi="समस्या बताएँ" className="text-sm font-semibold leading-tight" />
            </Link>
          )}
          <Link href="/consumables" className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-slate-300 bg-white px-2 text-center text-slate-700">
            <span className="text-2xl leading-none">🏪</span>
            <Bi en="Store stock" hi="स्टोर स्टॉक" className="text-sm font-semibold leading-tight" />
          </Link>
        </div>
      </Card>
      {canTrack && crew && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              <Bi en="Stages today" hi="आज की स्टेज" inline />
            </h2>
            <p className={`text-xs font-semibold ${unassigned > 0 ? "text-amber-700" : "text-slate-500"}`}>
              {present} present · {crew.assignedWorkerIds.size} on stages{unassigned > 0 ? ` · ${unassigned} not assigned to any stage` : ""}
            </p>
          </div>
          {boards.length === 0 ? (
            <Card><p className="text-sm text-slate-500">No active jobs yet.</p></Card>
          ) : (
            boards.map(({ job, stages }) => (
              <div key={job.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                <Link href={`/jobs/${job.id}`} className="mb-2 flex items-center justify-between px-1">
                  <span className="font-bold">{job.jobNumber} · {job.name}</span>
                  <span className="text-xs font-semibold text-brand">
                    {stages.filter((st) => st.done).length}/{stages.length} done ›
                  </span>
                </Link>
                {stages.length === 0 ? (
                  <p className="px-1 pb-1 text-xs text-slate-500">No stages written for this job yet.</p>
                ) : (
                  <ProgressEditor compact date={today} today={today} yesterday={today} jobId={job.id} stages={stages} workers={crew.workers} busyWorkers={crew.busyWorkers} />
                )}
              </div>
            ))
          )}
        </section>
      )}
      {canMark && (
        <Card title="Today's routine" hi="आज का काम">
          <ul className="divide-y">
            {steps.map((s) => (
              <li key={s.en}>
                <Link href={s.href} className="flex min-h-[52px] items-center justify-between py-2">
                  <Bi en={s.en} hi={s.hi} className={s.done ? "text-slate-400 line-through" : "font-semibold"} />
                  <span className={s.done ? "text-green-600" : "text-slate-400"}>{s.done ? "✓" : "›"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Superadmin: the exception-based morning screen                      */
/* ------------------------------------------------------------------ */
async function AdminDashboard() {
  const user = (await getSessionUser())!;
  const site = await getCurrentSite(user);
  if (!site) {
    return (
      <div className="space-y-4">
        <EmptyState en="No site set up yet." hi="अभी कोई साइट नहीं।" />
        <LinkButton href="/admin/sites/new" full>Create first site</LinkButton>
      </div>
    );
  }
  const d = await siteDashboard(site.id);
  const pendingCount = d.pendingCons.length + d.pendingPetty.length + d.pendingAdv.length + d.pendingExpenses.length + d.pendingItems.length;
  const workStopped = d.openIssues.filter((i) => i.severity === "WORK_STOPPED");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{formatDate(d.today)} · {d.site.name}</h1>
        <p className="text-sm text-slate-500">Exceptions first. No news here = site is fine.</p>
      </div>

      {/* Red flags stack */}
      {(d.dprMissingYesterday || d.dprMissingToday || workStopped.length > 0) && (
        <div className="space-y-2">
          {workStopped.map((i) => (
            <Link key={i.id} href={`/issues/${i.id}`} className="block rounded-2xl bg-red-600 p-3 font-bold text-white">
              ⛔ WORK STOPPED · {titleCase(i.category)}: {i.description} <span className="font-normal opacity-80">({i.ageHours}h)</span>
            </Link>
          ))}
          {d.dprMissingYesterday && (
            <Link href={`/dpr?date=${d.yesterday}`} className="block rounded-2xl bg-red-600 p-3 font-bold text-white">
              🔴 DPR MISSING for {formatDate(d.yesterday)}
            </Link>
          )}
          {d.dprMissingToday && (
            <Link href="/dpr" className="block rounded-2xl bg-red-500 p-3 font-bold text-white">
              🔴 Today's DPR not submitted (past 8 PM)
            </Link>
          )}
        </div>
      )}

      {/* Today at a glance */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/photos">
          <Stat label={`Photos ${d.slotsFilled.length}/5`} hi="फोटो" tone={d.slotsFilled.length >= 5 ? "green" : "red"}
            value={<span className="flex gap-0.5">{PHOTO_SLOTS.map((s) => (<span key={s.slot} className={`h-3 flex-1 rounded-sm ${d.slotsFilled.includes(s.slot) ? "bg-green-600" : "bg-red-400"}`} />))}</span>} />
        </Link>
        <Link href="/attendance">
          <Stat label="Manpower" hi="मज़दूर" value={`${formatNum(d.present, 1)}${d.planned !== null ? ` / ${d.planned} planned` : ` / ${d.workersActive}`}`}
            tone={d.planned !== null && d.present < d.planned ? "amber" : "slate"} />
        </Link>
        <Link href="/cash">
          <Stat label="Cash on site" hi="साइट पर कैश" value={formatINR(d.pettyBalance)} tone={d.pettyBalance < d.pettyThreshold ? "red" : "green"} />
        </Link>
        {/* Cash with people equals the site book by construction, so show the
            rate of spend here instead; the per-person split sits in the card below. */}
        <Link href="/expenses">
          <Stat label="Burn / day" hi="रोज़ खर्च" value={formatINR(Math.round(d.burnRate))} />
        </Link>
      </div>

      {/* Pending approvals */}
      <Card title={`Pending approvals (${pendingCount})`} hi="मंज़ूरी बाकी">
        {pendingCount === 0 ? (
          <p className="text-sm text-green-700">Nothing waiting for you 🎉</p>
        ) : (
          <ul className="divide-y">
            {d.pendingPetty.map((r) => (
              <ApprovalRow key={r.id} endpoint={`/api/petty/requests/${r.id}/decide`}
                label={<>💵 Cash: {formatINR(r.amount)} {r.urgency !== "NORMAL" && <Badge tone="red">{titleCase(r.urgency)}</Badge>}</>} sub={r.sub} />
            ))}
            {d.pendingCons.map((r) => (
              <ApprovalRow key={r.id} endpoint={`/api/consumables/requests/${r.id}/decide`} label={<>📦 {r.label}</>} sub={r.sub}
                extraApprove={[
                  { label: "✓ Factory", body: { decision: "APPROVED", fulfilment: "FROM_FACTORY" } },
                  { label: "✓ Buy local", body: { decision: "APPROVED", fulfilment: "LOCAL_PURCHASE" } },
                ]} />
            ))}
            {d.pendingAdv.map((r) => (
              <ApprovalRow key={r.id} endpoint={`/api/advances/${r.id}/decide`} label={<>🧾 Advance: {formatINR(r.amount)}</>} sub={r.sub} />
            ))}
            {d.pendingItems.map((r) => (
              <ApprovalRow key={r.id} endpoint={`/api/items/${r.id}/decide`} label={<>🆕 New item: {r.name} ({r.unit})</>} sub={`added by ${r.by} while ordering`} extraApprove={[{ label: "✓ Keep in master", body: { decision: "APPROVED" } }]} />
            ))}
            {d.pendingExpenses.map((r) => (
              <ApprovalRow key={r.id} endpoint={`/api/expenses/${r.id}/decide`} label={<>🧾 {formatINR(r.amount)} — {r.label}</>} sub={r.sub} />
            ))}
          </ul>
        )}
      </Card>

      {/* Jobs behind schedule */}
      {d.jobsBehind.length > 0 && (
        <Card title="Jobs behind schedule" hi="पीछे चल रहे काम">
          <ul className="divide-y">
            {d.jobsBehind.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex min-h-[48px] items-center justify-between py-2">
                  <div>
                    <div className="font-semibold">{j.jobNumber} · {j.name}</div>
                    <div className="text-xs text-red-600">
                      {j.bottleneck ? `Bottleneck: ${j.bottleneck} · ${j.overrun} days over` : `Behind plan: ${j.percent}% done, should be ${j.shouldBe}%`}
                    </div>
                  </div>
                  <span className="font-bold">{j.percent}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Consumption vs norm */}
      {d.normFlags.length > 0 && (
        <Card title="Welding consumption over norm" hi="खपत नॉर्म से ज़्यादा">
          <ul className="space-y-1 text-sm">
            {d.normFlags.map((n) => (
              <li key={n.jobNumber} className="rounded-lg bg-red-50 p-2 font-semibold text-red-700">
                ⚠ {n.jobNumber}: {n.actual} kg/MT vs norm {n.norm} kg/MT
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Issues */}
      <Card title={`Open issues (${d.openIssues.length})`} hi="खुली समस्याएँ" action={<Link href="/issues" className="text-sm font-semibold text-brand">All →</Link>}>
        {d.openIssues.length === 0 ? (
          <p className="text-sm text-green-700">No open issues 🎉</p>
        ) : (
          <ul className="divide-y text-sm">
            {d.openIssues.slice(0, 6).map((i) => (
              <li key={i.id}>
                <Link href={`/issues/${i.id}`} className="flex items-center gap-2 py-2">
                  <Badge tone={i.severity === "WORK_STOPPED" ? "red" : i.severity === "HIGH" ? "amber" : "slate"}>{titleCase(i.severity)}</Badge>
                  <span className="min-w-0 flex-1 truncate">{titleCase(i.category)}: {i.description}</span>
                  <span className={`text-xs ${i.ageHours > 48 ? "font-bold text-red-600" : "text-slate-400"}`}>{i.ageHours}h</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Petty cash expenses — the bulk of day-to-day spending */}
      <Card
        title="Petty cash this month"
        hi="इस महीने का खर्च"
        action={<Link href="/expenses" className="text-sm font-semibold text-brand">All →</Link>}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-2xl font-bold">{formatINR(d.monthTotal)}</span>
          {d.pendingExpenses.length > 0 && (
            <Link href="/expenses?status=PENDING" className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              {d.pendingExpenses.length} waiting
            </Link>
          )}
        </div>
        {d.spendByCategory.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing approved this month yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {d.spendByCategory.slice(0, 6).map((c) => {
              const pct = d.monthTotal > 0 ? Math.round((c.amount / d.monthTotal) * 100) : 0;
              return (
                <li key={c.name}>
                  <div className="flex justify-between text-sm">
                    <span className="min-w-0 truncate">{c.name}</span>
                    <span className="shrink-0 font-semibold">{formatINR(c.amount)}</span>
                  </div>
                  <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {d.cashHolders.length > 0 && (
          <div className="mt-3 border-t pt-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Cash in hand</div>
            <ul className="space-y-0.5 text-sm">
              {d.cashHolders.map((h) => (
                <li key={h.holderId} className="flex justify-between">
                  <span>{h.name}</span>
                  <b className={h.needsReconcile ? "text-red-600" : ""}>{formatINR(h.inHand)}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Machines + stock flags */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/machines">
          <Card title="Machines" hi="मशीनें" className="h-full">
            <div className="space-y-1 text-sm">
              <div>🟢 Running: <b>{d.machineCounts.RUNNING ?? 0}</b></div>
              <div>🟡 Idle: <b>{d.machineCounts.IDLE ?? 0}</b></div>
              <div className={(d.machineCounts.UNDER_REPAIR ?? 0) + (d.machineCounts.SENT_OUT_FOR_REPAIR ?? 0) > 0 ? "font-bold text-red-600" : ""}>
                🔴 Repair: <b>{(d.machineCounts.UNDER_REPAIR ?? 0) + (d.machineCounts.SENT_OUT_FOR_REPAIR ?? 0)}</b>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/consumables">
          <Card title="Low stock" hi="कम स्टॉक" className="h-full">
            {d.lowItems.length === 0 ? <p className="text-sm text-green-700">All OK</p> : (
              <ul className="space-y-0.5 text-xs text-red-700">
                {d.lowItems.slice(0, 5).map((i) => (<li key={i.name}>⚠ {i.name}: {i.qty} {i.unit}</li>))}
                {d.lowItems.length > 5 && <li>…and {d.lowItems.length - 5} more</li>}
              </ul>
            )}
          </Card>
        </Link>
      </div>

      {/* Cumulative progress */}
      <Card title="Job progress vs plan" hi="प्रगति बनाम योजना">
        <ProgressChart jobs={d.jobProgress} />
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <LinkButton href="/jobs" variant="outline"><Bi en="Jobs" hi="काम" /></LinkButton>
        <LinkButton href="/dpr" variant="outline"><Bi en="DPR" hi="डीपीआर" /></LinkButton>
      </div>
    </div>
  );
}
