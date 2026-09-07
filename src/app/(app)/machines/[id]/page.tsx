import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card } from "@/components/ui/Card";
import { PhotoLink } from "@/components/forms/PhotoLink";
import { MachinePanel } from "./MachinePanel";
import { dateToKey, formatDate, formatDateTime, formatINR, titleCase } from "@/lib/format";
import { MACHINE_STATUS_TONE } from "@/lib/machine-labels";

export default async function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("dpr.view");
  const { id } = await params;
  const m = await prisma.machine.findFirst({
    where: { id, active: true },
    include: {
      site: { select: { id: true, name: true, code: true } },
      dispatches: { where: { voidedAt: null }, orderBy: { dispatchDate: "desc" }, include: { dispatchedBy: { select: { name: true } }, receivedBy: { select: { name: true } }, site: { select: { code: true } } } },
      tickets: { where: { voidedAt: null }, orderBy: { raisedOn: "desc" }, include: { raisedBy: { select: { name: true } }, verifiedBy: { select: { name: true } }, parts: true } },
    },
  });
  if (!m) notFound();
  if (user.role !== "SUPERADMIN" && m.siteId !== user.siteId) notFound();
  const isAdmin = user.role === "SUPERADMIN";
  const canTicket = can(user.role, "machine.ticket") && !!m.siteId;
  const openTicket = m.tickets.find((t) => t.status !== "RESOLVED");
  const openDispatch = m.dispatches.find((d) => !d.receivedAt);
  const sites = isAdmin ? await prisma.site.findMany({ where: { active: true }, select: { id: true, name: true } }) : [];
  return (
    <div className="space-y-4">
      <PageHeader title={`${m.machineNumber} · ${titleCase(m.type)}`} hi={m.make ?? undefined} back="/machines" />
      <div className="flex flex-wrap gap-2">
        <Badge tone={MACHINE_STATUS_TONE[m.status]}>{titleCase(m.status)}</Badge>
        {m.site && <Badge tone="blue">{m.site.name}</Badge>}
        {!m.siteId && <Badge tone="slate">At factory</Badge>}
      </div>
      <MachinePanel
        machine={{ id: m.id, status: m.status, siteId: m.siteId, siteName: m.site?.name ?? null }}
        isAdmin={isAdmin}
        canTicket={canTicket}
        canSendBack={can(user.role, "machine.receive") && !!m.siteId}
        sites={sites}
        openTicket={
          openTicket
            ? { id: openTicket.id, problem: openTicket.problem, status: openTicket.status, repairType: openTicket.repairType, repairedBy: openTicket.repairedBy ?? "", repairCost: openTicket.repairCost ? Number(openTicket.repairCost) : null, downtimeDays: openTicket.downtimeDays ? Number(openTicket.downtimeDays) : null, parts: openTicket.parts.map((p) => ({ item: p.item, qty: Number(p.qty), price: Number(p.price) })) }
            : null
        }
        openDispatch={openDispatch ? { id: openDispatch.id, direction: openDispatch.direction, canAck: openDispatch.direction === "TO_SITE" ? can(user.role, "machine.receive") && user.siteId === openDispatch.siteId : isAdmin } : null}
      />
      <Card title="Maintenance history" hi="मरम्मत इतिहास">
        {m.tickets.length === 0 ? <p className="text-sm text-slate-500">No breakdowns recorded.</p> : (
          <ul className="divide-y text-sm">
            {m.tickets.map((t) => (
              <li key={t.id} className="py-2">
                <div className="flex items-center justify-between">
                  <b>{formatDate(t.raisedOn)}</b>
                  <Badge tone={t.status === "RESOLVED" ? "green" : "red"}>{titleCase(t.status)}</Badge>
                </div>
                <p>{t.problem}</p>
                <div className="text-xs text-slate-500">
                  Raised by {t.raisedBy.name}
                  {t.repairType && <> · {t.repairType === "IN_HOUSE" ? "repaired in-house" : "sent out"}{t.repairedBy ? ` by ${t.repairedBy}` : ""}</>}
                  {isAdmin && t.repairCost !== null && <> · cost {formatINR(t.repairCost)}</>}
                  {t.downtimeDays !== null && <> · {Number(t.downtimeDays)} days down</>}
                </div>
                {t.parts.length > 0 && (
                  <div className="text-xs text-slate-500">Parts: {t.parts.map((p) => `${p.item} ×${Number(p.qty)}${isAdmin ? ` (${formatINR(p.price)})` : ""}`).join(", ")}</div>
                )}
                {t.status === "RESOLVED" && (
                  <div className="mt-1 rounded-lg bg-green-50 p-2 text-xs">✍ Verified by <b>{t.verifiedBy?.name}</b> · {formatDateTime(t.verifiedAt)} — {t.verificationNote}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Dispatch / return register" hi="भेजना-वापसी">
        {m.dispatches.length === 0 ? <p className="text-sm text-slate-500">Never dispatched.</p> : (
          <ul className="divide-y text-sm">
            {m.dispatches.map((d) => (
              <li key={d.id} className="py-2">
                <div className="flex items-center justify-between">
                  <b>{d.direction === "TO_SITE" ? `Factory → ${d.site.code}` : `${d.site.code} → Factory`}</b>
                  {d.receivedAt ? <Badge tone={d.conditionOnReceipt === "NEEDS_REPAIR" ? "red" : "green"}>Received · {titleCase(d.conditionOnReceipt ?? "")}</Badge> : <Badge tone="amber">In transit</Badge>}
                </div>
                <div className="text-xs text-slate-500">
                  Sent {formatDate(dateToKey(d.dispatchDate))} ({titleCase(d.conditionOnDispatch)}) by {d.dispatchedBy.name}
                  {d.receivedBy && <> · received by {d.receivedBy.name}</>}
                  {d.remark && <> · {d.remark}</>}
                </div>
                <div className="flex gap-2"><PhotoLink url={d.dispatchPhotoUrl} size="h-12 w-12" /><PhotoLink url={d.receivedPhotoUrl} size="h-12 w-12" /></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
