import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { assertSiteAccess } from "@/lib/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { MaterialPlanner } from "./MaterialPlanner";

export default async function JobMaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("material.plan");
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, voidedAt: null } });
  if (!job) notFound();
  try {
    assertSiteAccess(user, job.siteId);
  } catch {
    notFound();
  }
  const [materials, items, requested, consumed] = await Promise.all([
    prisma.jobMaterial.findMany({ where: { jobId: job.id, voidedAt: null }, orderBy: { item: { name: "asc" } }, include: { item: true } }),
    prisma.consumableItem.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, name: true, unit: true, category: true } }),
    prisma.consumableRequest.groupBy({ by: ["itemId"], where: { siteId: job.siteId, voidedAt: null, status: { not: "REJECTED" } }, _sum: { qty: true } }),
    prisma.consumableConsumption.groupBy({ by: ["itemId"], where: { jobId: job.id, voidedAt: null }, _sum: { qty: true } }),
  ]);
  const reqMap = new Map(requested.map((r) => [r.itemId, Number(r._sum.qty ?? 0)]));
  const conMap = new Map(consumed.map((c) => [c.itemId, Number(c._sum.qty ?? 0)]));

  return (
    <div>
      <PageHeader title={`${job.jobNumber} materials`} hi="सामान की योजना" back={`/jobs/${job.id}`} />
      <MaterialPlanner
        jobId={job.id}
        canDelete={can(user.role, "record.delete")}
        items={items}
        planned={materials.map((m) => ({
          id: m.id,
          itemId: m.itemId,
          name: m.item.name,
          unit: m.item.unit,
          plannedQty: Number(m.plannedQty),
          note: m.note ?? "",
          requested: reqMap.get(m.itemId) ?? 0,
          consumed: conMap.get(m.itemId) ?? 0,
        }))}
      />
    </div>
  );
}
