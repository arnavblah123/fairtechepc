import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { RequestsBoard } from "./RequestsBoard";
import { dateToKey } from "@/lib/format";

export default async function ConsRequestsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requirePage("consumable.view");
  const openNew = (await searchParams).new === "1";
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const [requests, items, vendors] = await Promise.all([
    prisma.consumableRequest.findMany({
      where: { siteId: site.id, voidedAt: null },
      orderBy: [{ requestedAt: "desc" }],
      take: 200,
      include: {
        item: { select: { name: true, unit: true } },
        indent: { select: { id: true, indentNo: true, reason: true, note: true } },
        requestedBy: { select: { name: true } },
        decidedBy: { select: { name: true } },
        orderedBy: { select: { name: true } },
        dispatches: { where: { voidedAt: null }, select: { id: true, qty: true, receivedAt: true } },
      },
    }),
    prisma.consumableItem.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
    prisma.party.findMany({ where: { siteId: site.id, active: true, kind: "VENDOR" }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Material requests" hi="सामान रिक्वेस्ट" back="/consumables" />
      <datalist id="vendor-names">{vendors.map((v) => (<option key={v.name} value={v.name} />))}</datalist>
      <RequestsBoard
        siteId={site.id}
        canRequest={can(user.role, "consumable.request")}
        canApprove={can(user.role, "consumable.approve")}
        canOrder={can(user.role, "consumable.order")}
        canShip={can(user.role, "consumable.dispatch")}
        canClose={can(user.role, "consumable.receive")}
        canDelete={can(user.role, "record.delete")}
        canPropose={can(user.role, "item.propose")}
        showPrices={can(user.role, "money.view") || user.role === "PURCHASE"}
        openNew={openNew}
        items={items}
        requests={requests.map((r) => ({
          id: r.id,
          indentId: r.indent?.id ?? null,
          indentNo: r.indent?.indentNo ?? null,
          item: r.item.name,
          unit: r.item.unit,
          qty: Number(r.qty),
          reason: r.reason,
          neededBy: dateToKey(r.neededBy),
          status: r.status,
          fulfilment: r.fulfilment,
          by: r.requestedBy.name,
          decidedBy: r.decidedBy?.name ?? null,
          note: r.decisionNote,
          price: r.purchasePrice ? Number(r.purchasePrice) : null,
          vendor: r.vendorName,
          poNumber: r.poNumber,
          unitPrice: r.unitPrice ? Number(r.unitPrice) : null,
          expectedDate: r.expectedDate ? dateToKey(r.expectedDate) : null,
          orderedBy: r.orderedBy?.name ?? null,
          shipped: r.dispatches.length > 0,
          awaitingInward: r.dispatches.some((d) => !d.receivedAt),
        }))}
      />
    </div>
  );
}
