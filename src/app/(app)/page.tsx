import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { Card, Stat, EmptyState } from "@/components/ui/Card";
import { Bi } from "@/components/ui/Bi";
import { formatDate, istDateKey, dateKeyToDate } from "@/lib/format";
import { LinkButton } from "@/components/ui/Button";

export default async function HomePage() {
  const user = (await getSessionUser())!;
  const site = await getCurrentSite(user);
  const today = istDateKey();

  if (!site) {
    return (
      <div className="space-y-4">
        <EmptyState en="No site set up yet." hi="अभी कोई साइट नहीं बनी है।" />
        {can(user.role, "site.manage") && <LinkButton href="/admin/sites/new" full>Create first site</LinkButton>}
      </div>
    );
  }

  const [jobs, workers, presentToday, users] = await Promise.all([
    prisma.job.findMany({
      where: { siteId: site.id, voidedAt: null, status: { in: ["ACTIVE", "ON_HOLD"] } },
      orderBy: { jobNumber: "asc" },
      include: { stages: { where: { voidedAt: null }, select: { plannedDays: true, actualStart: true, actualEnd: true } } },
    }),
    prisma.worker.count({ where: { siteId: site.id, active: true } }),
    prisma.attendance.count({ where: { siteId: site.id, date: dateKeyToDate(today), status: { in: ["PRESENT", "HALF_DAY"] } } }),
    user.role === "SUPERADMIN" ? prisma.user.count({ where: { active: true } }) : Promise.resolve(0),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">
          <Bi en={`Today ${formatDate(today)}`} hi="आज" inline />
        </h1>
        <p className="text-sm text-slate-500">
          {site.name}, {site.city}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Active jobs" hi="चालू काम" value={jobs.length} tone="blue" />
        <Stat label="Present today" hi="आज हाज़िर" value={`${presentToday} / ${workers}`} tone={presentToday ? "green" : "amber"} />
      </div>

      {user.role === "SUPERADMIN" && (
        <Card title="Setup" hi="सेटअप">
          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin/users" className="rounded-xl bg-slate-50 p-3 active:bg-slate-100">
              <div className="text-2xl font-bold">{users}</div>
              <Bi en="Users" hi="यूज़र" className="text-sm font-semibold" />
            </Link>
            <Link href="/admin/sites" className="rounded-xl bg-slate-50 p-3 active:bg-slate-100">
              <div className="text-2xl font-bold">{site.code}</div>
              <Bi en="Sites" hi="साइट" className="text-sm font-semibold" />
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            The exception dashboard (DPR missing, photo slots, pending approvals, jobs behind schedule) arrives in Phase 9 once the data modules exist.
          </p>
        </Card>
      )}

      <Card title="Jobs" hi="काम" action={<Link href="/jobs" className="text-sm font-semibold text-brand">All →</Link>}>
        {jobs.length === 0 ? (
          <EmptyState en="No active jobs." hi="कोई चालू काम नहीं।" />
        ) : (
          <ul className="divide-y">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex min-h-[56px] items-center justify-between py-2">
                  <div>
                    <div className="font-semibold">
                      {j.jobNumber} · {j.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {j.clientName} · {Number(j.plannedTonnage)} MT · ends {formatDate(j.plannedEnd)}
                    </div>
                  </div>
                  <span className="text-slate-400">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Coming next" hi="आगे">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Phase 2: Attendance, labour master, daily plan</li>
          <li>Phase 3: Stage progress and DPR</li>
          <li>Phase 4: Geotagged photos</li>
        </ul>
      </Card>
    </div>
  );
}
