import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { BillForm } from "./BillForm";
import { balanceOf, pendingSpendOf } from "@/lib/ledger";
import { istDateKey, titleCase } from "@/lib/format";

export default async function NewExpensePage() {
  const user = await requirePage("expense.create");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const [categories, jobs, workers, machines, vendors, balance, pending] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.job.findMany({ where: { siteId: site.id, voidedAt: null, status: "ACTIVE" }, orderBy: { jobNumber: "asc" }, select: { id: true, jobNumber: true, name: true } }),
    prisma.worker.findMany({ where: { siteId: site.id, active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.machine.findMany({ where: { siteId: site.id, active: true }, orderBy: { machineNumber: "asc" }, select: { id: true, machineNumber: true, type: true } }),
    prisma.party.findMany({ where: { siteId: site.id, active: true }, orderBy: { name: "asc" }, select: { name: true } }),
    balanceOf(user.id),
    pendingSpendOf(user.id),
  ]);
  return (
    <div>
      <PageHeader title="Add bill / expense" hi="बिल / खर्च भरें" back="/expenses" />
      <BillForm
        today={istDateKey()}
        inHand={balance.inHand}
        pending={pending}
        categories={categories.map((c) => ({ id: c.id, name: c.name, requiresPerson: c.requiresPerson, requiresMachine: c.requiresMachine }))}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.jobNumber} · ${j.name}` }))}
        workers={workers.map((w) => ({ id: w.id, label: `${w.code} · ${w.name}` }))}
        machines={machines.map((m) => ({ id: m.id, label: `${m.machineNumber} · ${titleCase(m.type)}` }))}
        vendors={vendors.map((v) => v.name)}
      />
    </div>
  );
}
