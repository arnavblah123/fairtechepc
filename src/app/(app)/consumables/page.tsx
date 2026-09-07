import Link from "next/link";
import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card, EmptyState } from "@/components/ui/Card";
import { Bi } from "@/components/ui/Bi";
import { formatNum, titleCase } from "@/lib/format";
import { ExportLink } from "@/components/forms/ExportLink";

export default async function ConsumablesPage() {
  const user = await requirePage("dpr.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const [stock, pendingReceipts, pendingRequests] = await Promise.all([
    prisma.consumableStock.findMany({ where: { siteId: site.id, item: { active: true } }, include: { item: true }, orderBy: [{ item: { category: "asc" } }, { item: { name: "asc" } }] }),
    prisma.consumableDispatch.count({ where: { siteId: site.id, receivedAt: null, voidedAt: null } }),
    prisma.consumableRequest.count({ where: { siteId: site.id, status: "PENDING", voidedAt: null } }),
  ]);
  const byCat = new Map<string, typeof stock>();
  for (const s of stock) byCat.set(s.item.category, [...(byCat.get(s.item.category) ?? []), s]);
  return (
    <div>
      <PageHeader title="Consumables store" hi="कंज़्यूमेबल स्टोर" back="/more" action={can(user.role, "export.csv") ? <ExportLink href={`/api/consumables/export?siteId=${site.id}`} /> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-2 text-center text-sm font-semibold">
        {can(user.role, "consumable.consume") && (
          <Link href="/consumables/consume" className="rounded-xl bg-brand py-3 text-white"><Bi en="Enter consumption" hi="खपत भरें" /></Link>
        )}
        {can(user.role, "consumable.request") && (
          <Link href="/consumables/requests" className="relative rounded-xl bg-slate-800 py-3 text-white">
            <Bi en="Requests" hi="रिक्वेस्ट" />
          </Link>
        )}
        {can(user.role, "consumable.approve") && (
          <Link href="/consumables/requests" className="relative rounded-xl bg-slate-800 py-3 text-white">
            <Bi en="Requests" hi="रिक्वेस्ट" />
            {pendingRequests > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs">{pendingRequests}</span>}
          </Link>
        )}
        <Link href="/consumables/dispatches" className="relative rounded-xl border-2 border-slate-300 bg-white py-3 text-slate-700">
          <Bi en="Dispatches" hi="भेजा गया माल" />
          {pendingReceipts > 0 && can(user.role, "consumable.receive") && <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{pendingReceipts}</span>}
        </Link>
        {can(user.role, "consumable.approve") && (
          <Link href="/admin/items" className="rounded-xl border-2 border-slate-300 bg-white py-3 text-slate-700"><Bi en="Item master" hi="आइटम सूची" /></Link>
        )}
      </div>
      {[...byCat.entries()].map(([cat, list]) => (
        <Card key={cat} title={titleCase(cat)} className="mb-3">
          <ul className="divide-y text-sm">
            {list.map((s) => {
              const low = Number(s.qtyOnHand) <= Number(s.item.reorderLevel);
              return (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <span className="min-w-0 flex-1 truncate">{s.item.name}</span>
                  <span className={`font-bold ${low ? "text-red-600" : ""}`}>
                    {formatNum(s.qtyOnHand)} {s.item.unit}
                  </span>
                  {low && <Badge tone="red">Low</Badge>}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
