import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { assertSiteAccess } from "@/lib/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressEditor } from "./ProgressEditor";
import { istDateKey, addDays, dateKeyToDate, dateToKey } from "@/lib/format";

export default async function ProgressPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const user = await requirePage("stage.progress");
  const { id } = await params;
  const sp = await searchParams;
  const today = istDateKey();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const job = await prisma.job.findFirst({
    where: { id, voidedAt: null },
    include: { stages: { where: { voidedAt: null }, orderBy: { sequence: "asc" } } },
  });
  if (!job) notFound();
  try {
    assertSiteAccess(user, job.siteId);
  } catch {
    notFound();
  }
  const dateObj = dateKeyToDate(date);
  const [progress, workers, todaysLogs] = await Promise.all([
    prisma.stageProgress.findMany({ where: { jobId: job.id, date: dateObj, voidedAt: null }, include: { workLogs: true } }),
    prisma.worker.findMany({ where: { siteId: job.siteId, active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, trade: true } }),
    prisma.stageWorkLog.findMany({ where: { date: dateObj, worker: { siteId: job.siteId } }, include: { stageProgress: { include: { stage: { select: { id: true, name: true } } } } } }),
  ]);
  return (
    <div>
      <PageHeader title={`${job.jobNumber} progress`} hi="स्टेज प्रगति" back={`/jobs/${job.id}`} />
      <ProgressEditor
        date={date}
        today={today}
        yesterday={addDays(today, -1)}
        jobId={job.id}
        stages={job.stages.map((s) => {
          const p = progress.find((x) => x.stageId === s.id);
          return {
            id: s.id,
            name: `${s.sequence}. ${s.name}`,
            unit: s.unit,
            plannedQty: Number(s.plannedQty),
            entry: p
              ? { qtyDone: String(Number(p.qtyDone)), percentComplete: String(Number(p.percentComplete)), remark: p.remark ?? "", workers: p.workLogs.map((w) => ({ workerId: w.workerId, hours: Number(w.hours), shift: w.shift })) }
              : null,
          };
        })}
        workers={workers}
        busyWorkers={Object.fromEntries(todaysLogs.map((l) => [`${l.workerId}:${l.shift}`, l.stageProgress.stage.name]))}
      />
    </div>
  );
}
