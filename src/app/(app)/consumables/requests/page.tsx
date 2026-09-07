import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { RequestsBoard } from "./RequestsBoard";
import { dateToKey } from "@/lib/format";

export default async function ConsRequestsPage() {
  const user = await requirePage("dpr.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const [requests, items] = await Promise.all([
    prisma.consumableRequest.findMany({
      where: { siteId: site.id, voidedAt: null },
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      take: 100,
      include: { item: { select: { name: true, unit: true } }, requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } },
    }),
    prisma.consumableItem.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Consumable requests" hi="सामान रिक्वेस्ट" back="/consumables" />
      <RequestsBoard
        siteId={site.id}
        canRequest={can(user.role, "consumable.request")}
        canApprove={can(user.role, "consumable.approve")}
        canClose={can(user.role, "consumable.receive")}
        items={items}
        requests={requests.map((r) => ({
          id: r.id,
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
        }))}
      />
    </div>
  );
}
