import Link from "next/link";
import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card, EmptyState } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Bi } from "@/components/ui/Bi";
import { formatDate, formatNum } from "@/lib/format";
import { ExportLink } from "@/components/forms/ExportLink";

const STATUS_TONE = { ACTIVE: "green", ON_HOLD: "amber", COMPLETED: "blue", CLOSED: "slate" } as const;

export default async function JobsPage() {
  const user = await requirePage("job.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." hi="कोई साइट नहीं चुनी।" />;
  const jobs = await prisma.job.findMany({
    where: { siteId: site.id, voidedAt: null },
    orderBy: [{ status: "asc" }, { jobNumber: "asc" }],
    include: { _count: { select: { stages: { where: { voidedAt: null } } } } },
  });
  return (
    <div>
      <PageHeader title="Jobs" hi="काम" action={can(user.role, "export.csv") ? <ExportLink href={`/api/jobs/export?siteId=${site.id}`} /> : undefined} />
      {can(user.role, "job.manage") && (
        <LinkButton href="/jobs/new" full size="lg" className="mb-4">
          + <Bi en="New job" hi="नया काम" />
        </LinkButton>
      )}
      {jobs.length === 0 ? (
        <EmptyState en="No jobs yet." hi="अभी कोई काम नहीं।" />
      ) : (
        <Card>
          <ul className="divide-y">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex min-h-[64px] items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{j.jobNumber}</span>
                      <Badge tone={STATUS_TONE[j.status]}>{j.status.replace("_", " ")}</Badge>
                    </div>
                    <div className="truncate font-semibold">{j.name}</div>
                    <div className="text-xs text-slate-500">
                      {j.clientName} · {formatNum(j.plannedTonnage)} MT · {formatDate(j.plannedStart)} → {formatDate(j.plannedEnd)} · {j._count.stages} stages
                    </div>
                  </div>
                  <span className="text-slate-400">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
