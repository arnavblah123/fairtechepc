import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { RepairRequestForm } from "./RepairRequestForm";
import { istDateKey, dateToKey } from "@/lib/format";
import { titleCase } from "@/lib/format";

export default async function MachineRepairPage() {
  const user = await requirePage("machine.ticket");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const machines = await prisma.machine.findMany({
    where: { siteId: site.id, active: true },
    orderBy: { machineNumber: "asc" },
    include: { tickets: { where: { status: { not: "RESOLVED" }, voidedAt: null }, select: { id: true, problem: true, raisedOn: true } } },
  });
  return (
    <div>
      <PageHeader title="Machine repair" hi="मशीन मरम्मत" back="/" />
      <RepairRequestForm
        today={istDateKey()}
        machines={machines.map((m) => ({
          id: m.id,
          label: `${m.machineNumber} · ${titleCase(m.type)}${m.make ? ` (${m.make})` : ""}`,
          status: m.status,
          openTicket: m.tickets[0] ? { id: m.tickets[0].id, problem: m.tickets[0].problem, raisedOn: dateToKey(m.tickets[0].raisedOn) } : null,
        }))}
      />
    </div>
  );
}
