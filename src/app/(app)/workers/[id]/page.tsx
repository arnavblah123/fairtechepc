import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { assertSiteAccess } from "@/lib/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { WorkerForm } from "../WorkerForm";
import { RateSection } from "./RateSection";
import { dateToKey, formatDate, formatINR } from "@/lib/format";

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("worker.view");
  const { id } = await params;
  const worker = await prisma.worker.findUnique({ where: { id }, include: { wageRates: { orderBy: { effectiveFrom: "desc" }, include: { setBy: { select: { name: true } } } } } });
  if (!worker) notFound();
  try {
    assertSiteAccess(user, worker.siteId);
  } catch {
    notFound();
  }
  const canManage = can(user.role, "worker.manage");
  const canRate = can(user.role, "wage.rate");
  return (
    <div className="space-y-4">
      <PageHeader title={`${worker.code} · ${worker.name}`} hi={worker.contractorName ?? undefined} back="/workers" />
      {canRate && (
        <RateSection
          workerId={worker.id}
          wageType={worker.wageType}
          rates={worker.wageRates.map((r) => ({ id: r.id, rate: Number(r.rate), otRate: r.otRate ? Number(r.otRate) : null, effectiveFrom: dateToKey(r.effectiveFrom), setBy: r.setBy.name }))}
        />
      )}
      {canManage ? (
        <WorkerForm
          siteId={worker.siteId}
          worker={{
            id: worker.id,
            name: worker.name,
            phone: worker.phone ?? "",
            trade: worker.trade,
            joiningDate: dateToKey(worker.joiningDate),
            wageType: worker.wageType,
            contractorName: worker.contractorName ?? "",
            idDocRef: worker.idDocRef ?? "",
            photoUrl: worker.photoUrl ?? "",
            active: worker.active,
          }}
        />
      ) : (
        <Card>
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-slate-500">Trade</dt>
            <dd className="col-span-2">{worker.trade}</dd>
            <dt className="text-slate-500">Phone</dt>
            <dd className="col-span-2">{worker.phone ?? "—"}</dd>
            <dt className="text-slate-500">Joined</dt>
            <dd className="col-span-2">{formatDate(worker.joiningDate)}</dd>
          </dl>
        </Card>
      )}
      {canRate && worker.wageRates[0] && (
        <p className="text-xs text-slate-500">
          Current rate {formatINR(worker.wageRates[0].rate)} {worker.wageType === "PER_DAY" ? "per day" : "per hour"}. Rates are visible only to you.
        </p>
      )}
    </div>
  );
}
