import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, Stat } from "@/components/ui/Card";
import { Bi } from "@/components/ui/Bi";
import { LinkButton } from "@/components/ui/Button";
import { formatDate, formatINR, formatNum, istDateKey, dateKeyToDate, titleCase } from "@/lib/format";
import { siteDashboard } from "@/lib/dashboard";
import { ProgressChart } from "@/components/dashboard/ProgressChart";
import { ApprovalRow } from "@/components/dashboard/ApprovalRow";
import { PHOTO_SLOTS } from "@/lib/slots";

export default async function HomePage() {
  const user = (await getSessionUser())!;
  if (user.role === "SUPERADMIN") return <AdminDashboard />;
  return <SiteHome />;
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
  const steps: { href: string; en: string; hi: string; done: boolean }[] = [
    { href: "/attendance", en: "Muster photo + attendance", hi: "मस्टर फोटो और हाज़िरी", done: muster > 0 && present > 0 },
    { href: "/plan", en: "Daily plan", hi: "दैनिक योजना", done: !!plan },
    { href: "/photos", en: `Site photos (${filled.size}/5)`, hi: "साइट फोटो", done: filled.size >= 5 },
    { href: "/jobs", en: "Stage progress", hi: "स्टेज प्रगति", done: false },
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
      <div className="grid grid-cols-2 gap-2">
        <LinkButton href="/issues/new" variant="danger">⚠ <Bi en="Raise issue" hi="समस्या" /></LinkButton>
        <LinkButton href="/consumables" variant="outline"><Bi en="Store" hi="स्टोर" /></LinkButton>
      </div>
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
  const pendingCount = d.pendingCons.length + d.pendingPetty.length + d.pendingAdv.length;
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
        <Link href="/petty-cash">
          <Stat label="Petty cash" hi="पेटी कैश" value={formatINR(d.pettyBalance)} tone={d.pettyBalance < d.pettyThreshold ? "red" : "green"} />
        </Link>
        <Stat label="Burn / day" hi="रोज़ खर्च" value={formatINR(Math.round(d.burnRate))} />
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
                    <div className="text-xs text-red-600">Bottleneck: {j.bottleneck} · {j.overrun} days over</div>
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
      <Card title="Project progress: planned vs actual MT" hi="कुल प्रगति">
        <ProgressChart totalPlannedMT={d.chart.totalPlannedMT} planStart={d.chart.planStart} planEnd={d.chart.planEnd} actualCum={d.chart.actualCum} today={d.today} />
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <LinkButton href="/jobs" variant="outline"><Bi en="Jobs" hi="काम" /></LinkButton>
        <LinkButton href="/dpr" variant="outline"><Bi en="DPR" hi="डीपीआर" /></LinkButton>
      </div>
    </div>
  );
}
