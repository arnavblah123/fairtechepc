import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { IssueForm } from "./IssueForm";

export default async function NewIssuePage() {
  const user = await requirePage("issue.raise");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const jobs = await prisma.job.findMany({ where: { siteId: site.id, voidedAt: null }, orderBy: { jobNumber: "asc" }, select: { id: true, jobNumber: true, name: true } });
  return (
    <div>
      <PageHeader title="Raise issue" hi="समस्या दर्ज करें" back="/issues" />
      <IssueForm siteId={site.id} jobs={jobs.map((j) => ({ id: j.id, label: `${j.jobNumber} · ${j.name}` }))} />
    </div>
  );
}
