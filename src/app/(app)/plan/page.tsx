import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { PlanEditor } from "./PlanEditor";
import { istDateKey, dateKeyToDate } from "@/lib/format";

export default async function PlanPage() {
  const user = await requirePage("plan.submit");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const today = istDateKey();
  const [jobs, plan] = await Promise.all([
    prisma.job.findMany({
      where: { siteId: site.id, voidedAt: null, status: "ACTIVE" },
      orderBy: { jobNumber: "asc" },
      include: { stages: { where: { voidedAt: null }, orderBy: { sequence: "asc" }, select: { id: true, name: true, unit: true } } },
    }),
    prisma.dailyPlan.findUnique({
      where: { siteId_date: { siteId: site.id, date: dateKeyToDate(today) } },
      include: { items: true, submittedBy: { select: { name: true } } },
    }),
  ]);
  return (
    <div>
      <PageHeader title="Daily plan" hi="दैनिक योजना" back="/more" />
      <PlanEditor
        siteId={site.id}
        date={today}
        canSubmit={can(user.role, "plan.submit")}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.jobNumber} · ${j.name}`, stages: j.stages }))}
        existing={
          plan
            ? {
                remark: plan.remark ?? "",
                submittedBy: plan.submittedBy.name,
                items: plan.items.map((i) => ({ jobId: i.jobId, stageId: i.stageId, targetQty: String(Number(i.targetQty)), manpowerPlanned: String(i.manpowerPlanned), note: i.note ?? "" })),
              }
            : null
        }
      />
    </div>
  );
}
