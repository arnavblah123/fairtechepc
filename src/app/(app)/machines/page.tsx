import Link from "next/link";
import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card, EmptyState } from "@/components/ui/Card";
import { titleCase } from "@/lib/format";
import { MACHINE_STATUS_TONE } from "@/lib/machine-labels";
import { NewMachineButton } from "./NewMachineButton";

export default async function MachinesPage() {
  const user = await requirePage("dpr.view");
  const site = await getCurrentSite(user);
  const isAdmin = user.role === "SUPERADMIN";
  const machines = await prisma.machine.findMany({
    where: { active: true, ...(isAdmin ? {} : { siteId: user.siteId ?? "-" }) },
    orderBy: { machineNumber: "asc" },
    include: { site: { select: { code: true, name: true } }, tickets: { where: { status: { not: "RESOLVED" }, voidedAt: null }, select: { id: true } } },
  });
  const atSite = machines.filter((m) => m.siteId);
  const atFactory = machines.filter((m) => !m.siteId);
  return (
    <div>
      <PageHeader title="Machines" hi="मशीनें" back="/more" action={isAdmin ? <NewMachineButton /> : undefined} />
      {machines.length === 0 && <EmptyState en="No machines yet." hi="अभी कोई मशीन नहीं।" />}
      {atSite.length > 0 && (
        <Card title={`At site (${atSite.length})`} hi="साइट पर" className="mb-3">
          <MachineList machines={atSite} showSite={isAdmin} />
        </Card>
      )}
      {isAdmin && atFactory.length > 0 && (
        <Card title={`At factory (${atFactory.length})`} hi="फैक्ट्री में">
          <MachineList machines={atFactory} showSite={false} />
        </Card>
      )}
      {!isAdmin && site && <p className="mt-2 text-xs text-slate-500">Machines shown are the ones currently at {site.name}.</p>}
    </div>
  );
}

function MachineList({ machines, showSite }: { machines: { id: string; machineNumber: string; type: string; make: string | null; status: string; site: { code: string } | null; tickets: { id: string }[] }[]; showSite: boolean }) {
  return (
    <ul className="divide-y">
      {machines.map((m) => (
        <li key={m.id}>
          <Link href={`/machines/${m.id}`} className="flex min-h-[56px] items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <div className="font-semibold">{m.machineNumber} · {titleCase(m.type)}</div>
              <div className="text-xs text-slate-500">{m.make ?? ""}{showSite && m.site ? ` · ${m.site.code}` : ""}</div>
            </div>
            <div className="flex items-center gap-1.5">
              {m.tickets.length > 0 && <Badge tone="red">ticket</Badge>}
              <Badge tone={MACHINE_STATUS_TONE[m.status as keyof typeof MACHINE_STATUS_TONE]}>{titleCase(m.status)}</Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
