import Link from "next/link";
import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card, EmptyState } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Bi } from "@/components/ui/Bi";
import { formatDateTime, titleCase } from "@/lib/format";

const SEV_TONE = { LOW: "slate", MEDIUM: "blue", HIGH: "amber", WORK_STOPPED: "red" } as const;
const STATUS_TONE = { OPEN: "red", ACKNOWLEDGED: "amber", IN_PROGRESS: "blue", RESOLVED: "green" } as const;

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ resolved?: string }> }) {
  const user = await requirePage("dpr.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const showResolved = (await searchParams).resolved === "1";
  const issues = await prisma.issue.findMany({
    where: { siteId: site.id, voidedAt: null, status: showResolved ? "RESOLVED" : { not: "RESOLVED" } },
    orderBy: showResolved ? [{ resolvedAt: "desc" }] : [{ raisedAt: "asc" }],
    take: showResolved ? 50 : undefined,
    include: { raisedBy: { select: { name: true } }, job: { select: { jobNumber: true } } },
  });
  const sorted = showResolved ? issues : [...issues].sort((a, b) => (a.severity === "WORK_STOPPED" ? -1 : 0) - (b.severity === "WORK_STOPPED" ? -1 : 0));
  const now = Date.now();
  return (
    <div>
      <PageHeader title="Issues" hi="समस्याएँ" back="/more" />
      {can(user.role, "issue.raise") && (
        <LinkButton href="/issues/new" full size="lg" className="mb-4" variant="danger">
          ⚠ <Bi en="Raise issue" hi="समस्या दर्ज करें" />
        </LinkButton>
      )}
      <div className="mb-3 flex gap-2 text-sm font-semibold">
        <Link href="/issues" className={`rounded-full px-3 py-1.5 ${!showResolved ? "bg-brand text-white" : "bg-white"}`}>Open</Link>
        <Link href="/issues?resolved=1" className={`rounded-full px-3 py-1.5 ${showResolved ? "bg-brand text-white" : "bg-white"}`}>Resolved</Link>
      </div>
      {sorted.length === 0 ? (
        <EmptyState en={showResolved ? "No resolved issues yet." : "No open issues 🎉"} hi={showResolved ? "" : "कोई खुली समस्या नहीं"} />
      ) : (
        <Card>
          <ul className="divide-y">
            {sorted.map((i) => {
              const ageH = Math.round((now - i.raisedAt.getTime()) / 3600000);
              const escalated = !showResolved && ageH > 48;
              return (
                <li key={i.id}>
                  <Link href={`/issues/${i.id}`} className={`block py-2.5 ${i.severity === "WORK_STOPPED" && !showResolved ? "-mx-2 rounded-lg bg-red-50 px-2" : ""}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={SEV_TONE[i.severity]}>{titleCase(i.severity)}</Badge>
                      <Badge tone={STATUS_TONE[i.status]}>{titleCase(i.status)}</Badge>
                      {escalated && <Badge tone="red">⏰ {Math.floor(ageH / 24)}d {ageH % 24}h old</Badge>}
                      {i.job && <span className="text-xs text-slate-500">{i.job.jobNumber}</span>}
                    </div>
                    <div className="mt-1 font-semibold">{titleCase(i.category)}: {i.description.slice(0, 120)}</div>
                    <div className="text-xs text-slate-500">{i.raisedBy.name} · {formatDateTime(i.raisedAt)}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
