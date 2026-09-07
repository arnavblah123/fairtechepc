import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { assertSiteAccess } from "@/lib/site";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card } from "@/components/ui/Card";
import { PhotoLink } from "@/components/forms/PhotoLink";
import { IssueActions } from "./IssueActions";
import { formatDateTime, titleCase } from "@/lib/format";

const SEV_TONE = { LOW: "slate", MEDIUM: "blue", HIGH: "amber", WORK_STOPPED: "red" } as const;

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("dpr.view");
  const { id } = await params;
  const issue = await prisma.issue.findFirst({
    where: { id, voidedAt: null },
    include: { raisedBy: { select: { name: true } }, closedBy: { select: { name: true } }, job: { select: { jobNumber: true, name: true } } },
  });
  if (!issue) notFound();
  try {
    assertSiteAccess(user, issue.siteId);
  } catch {
    notFound();
  }
  return (
    <div className="space-y-4">
      <PageHeader title={titleCase(issue.category)} hi="समस्या" back="/issues" />
      <div className="flex flex-wrap gap-2">
        <Badge tone={SEV_TONE[issue.severity]}>{titleCase(issue.severity)}</Badge>
        <Badge tone={issue.status === "RESOLVED" ? "green" : issue.status === "OPEN" ? "red" : "amber"}>{titleCase(issue.status)}</Badge>
        {issue.job && <Badge tone="blue">{issue.job.jobNumber}</Badge>}
      </div>
      <Card>
        <p className="whitespace-pre-wrap">{issue.description}</p>
        {issue.neededFromHO && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><b>Needed from head office:</b> {issue.neededFromHO}</p>
        )}
        <div className="mt-3"><PhotoLink url={issue.photoUrl} size="h-24 w-24" /></div>
        <div className="mt-3 text-xs text-slate-500">
          Raised by {issue.raisedBy.name} · {formatDateTime(issue.raisedAt)}
          {issue.acknowledgedAt && <> · Acknowledged {formatDateTime(issue.acknowledgedAt)}</>}
        </div>
        {issue.status === "RESOLVED" && (
          <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm">
            <b>Resolved</b> by {issue.closedBy?.name} · {formatDateTime(issue.resolvedAt)}
            <p className="mt-1">{issue.resolutionNote}</p>
          </div>
        )}
      </Card>
      {issue.status !== "RESOLVED" && (
        <IssueActions issueId={issue.id} status={issue.status} canAck={user.role === "SUPERADMIN"} canResolve={can(user.role, "issue.resolve")} />
      )}
    </div>
  );
}
