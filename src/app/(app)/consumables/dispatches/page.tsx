import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { DispatchBoard } from "./DispatchBoard";
import { dateToKey } from "@/lib/format";

export default async function DispatchesPage() {
  const user = await requirePage("dpr.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const [dispatches, items] = await Promise.all([
    prisma.consumableDispatch.findMany({
      where: { siteId: site.id, voidedAt: null },
      orderBy: [{ receivedAt: "asc" }, { dispatchDate: "desc" }],
      take: 100,
      include: { item: { select: { name: true, unit: true } }, dispatchedBy: { select: { name: true } }, receivedBy: { select: { name: true } } },
    }),
    prisma.consumableItem.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Stock dispatches" hi="भेजा गया माल" back="/consumables" />
      <DispatchBoard
        siteId={site.id}
        canDispatch={can(user.role, "consumable.dispatch")}
        canReceive={can(user.role, "consumable.receive")}
        items={items}
        dispatches={dispatches.map((d) => ({
          id: d.id,
          item: d.item.name,
          unit: d.item.unit,
          qty: Number(d.qty),
          date: dateToKey(d.dispatchDate),
          photoUrl: d.photoUrl,
          received: d.receivedAt ? { qty: Number(d.receivedQty), by: d.receivedBy?.name ?? "", short: d.shortReceipt, remark: d.receiptRemark } : null,
        }))}
      />
    </div>
  );
}
