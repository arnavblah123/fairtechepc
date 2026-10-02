import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { assertSiteAccess } from "@/lib/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressEditor } from "./ProgressEditor";
import { istDateKey, addDays } from "@/lib/format";
import { siteWorkersForDate, stageRowsForJob } from "@/lib/progress-board";

export default async function ProgressPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const user = await requirePage("stage.progress");
  const { id } = await params;
  const sp = await searchParams;
  const today = istDateKey();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const job = await prisma.job.findFirst({ where: { id, voidedAt: null }, select: { id: true, jobNumber: true, siteId: true } });
  if (!job) notFound();
  try {
    assertSiteAccess(user, job.siteId);
  } catch {
    notFound();
  }
  const [stages, { workers, busyWorkers }] = await Promise.all([stageRowsForJob(job.id, date, today), siteWorkersForDate(job.siteId, date)]);
  return (
    <div>
      <PageHeader title={`${job.jobNumber} progress`} hi="स्टेज प्रगति" back={`/jobs/${job.id}`} />
      <ProgressEditor date={date} today={today} yesterday={addDays(today, -1)} jobId={job.id} stages={stages} workers={workers} busyWorkers={busyWorkers} />
    </div>
  );
}
