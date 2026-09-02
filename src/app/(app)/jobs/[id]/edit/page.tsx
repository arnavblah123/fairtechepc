import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { JobForm } from "../../JobForm";
import { dateToKey } from "@/lib/format";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("job.manage");
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, voidedAt: null } });
  if (!job) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${job.jobNumber}`} hi="काम बदलें" back={`/jobs/${job.id}`} />
      <JobForm
        siteId={job.siteId}
        job={{
          id: job.id,
          name: job.name,
          clientName: job.clientName,
          description: job.description ?? "",
          drawingRef: job.drawingRef ?? "",
          plannedTonnage: String(Number(job.plannedTonnage)),
          plannedStart: dateToKey(job.plannedStart),
          plannedEnd: dateToKey(job.plannedEnd),
          weldingNormKgPerMT: job.weldingNormKgPerMT ? String(Number(job.weldingNormKgPerMT)) : "",
          status: job.status,
        }}
      />
    </div>
  );
}
