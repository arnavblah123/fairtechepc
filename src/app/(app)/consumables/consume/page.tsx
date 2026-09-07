import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { ConsumeForm } from "./ConsumeForm";
import { istDateKey, dateKeyToDate, formatNum } from "@/lib/format";

export default async function ConsumePage() {
  const user = await requirePage("consumable.consume");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const today = istDateKey();
  const [stock, jobs, todays] = await Promise.all([
    prisma.consumableStock.findMany({ where: { siteId: site.id, item: { active: true } }, include: { item: true }, orderBy: { item: { name: "asc" } } }),
    prisma.job.findMany({ where: { siteId: site.id, voidedAt: null, status: "ACTIVE" }, orderBy: { jobNumber: "asc" }, include: { stages: { where: { voidedAt: null }, orderBy: { sequence: "asc" }, select: { id: true, name: true } } } }),
    prisma.consumableConsumption.findMany({ where: { siteId: site.id, date: dateKeyToDate(today), voidedAt: null }, include: { item: true, job: { select: { jobNumber: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div>
      <PageHeader title="Daily consumption" hi="आज की खपत" back="/consumables" />
      <ConsumeForm
        date={today}
        items={stock.map((s) => ({ id: s.itemId, name: s.item.name, unit: s.item.unit, onHand: Number(s.qtyOnHand) }))}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.jobNumber} · ${j.name}`, stages: j.stages }))}
        todays={todays.map((t) => `${t.item.name}: ${formatNum(t.qty)} ${t.item.unit} (${t.job.jobNumber})`)}
      />
    </div>
  );
}
