import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StageManager } from "./StageManager";

export default async function StagesPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("stage.manage");
  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, voidedAt: null },
    include: { stages: { where: { voidedAt: null }, orderBy: { sequence: "asc" }, include: { _count: { select: { progress: true } } } } },
  });
  if (!job) notFound();
  return (
    <div>
      <PageHeader title={`${job.jobNumber} stages`} hi="स्टेज सेट करें" back={`/jobs/${job.id}`} />
      <StageManager
        jobId={job.id}
        plannedTonnage={Number(job.plannedTonnage)}
        stages={job.stages.map((s) => ({ id: s.id, sequence: s.sequence, name: s.name, unit: s.unit, plannedQty: Number(s.plannedQty), plannedDays: s.plannedDays, hasProgress: s._count.progress > 0 }))}
      />
    </div>
  );
}
