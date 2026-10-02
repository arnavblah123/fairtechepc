import Link from "next/link";
import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card, EmptyState } from "@/components/ui/Card";
import { formatDate, formatINR, titleCase } from "@/lib/format";
import { toPaise, toRupees } from "@/lib/money";

/** Every name money went to, with what has been paid, what is waiting, and what is on order. */
export default async function VendorsPage() {
  const user = await requirePage("vendor.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const parties = await prisma.party.findMany({
    where: { siteId: site.id, active: true },
    orderBy: { name: "asc" },
    include: {
      expenses: { where: { voidedAt: null }, select: { amount: true, status: true, date: true } },
      orders: { where: { voidedAt: null }, select: { status: true } },
      _count: { select: { bills: true } },
    },
  });
  const rows = parties
    .map((p) => {
      const approved = toRupees(p.expenses.filter((e) => e.status === "APPROVED").reduce((a, e) => a + toPaise(e.amount), 0));
      const waiting = toRupees(p.expenses.filter((e) => e.status === "PENDING" || e.status === "QUERIED").reduce((a, e) => a + toPaise(e.amount), 0));
      const last = p.expenses.map((e) => e.date).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const openOrders = p.orders.filter((o) => o.status === "APPROVED" || o.status === "ORDERED").length;
      return { id: p.id, name: p.name, kind: p.kind, approved, waiting, bills: p.expenses.length, orders: p.orders.length, openOrders, last };
    })
    .sort((a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));
  const total = rows.reduce((a, r) => a + r.approved, 0);
  return (
    <div>
      <PageHeader title="Vendors & payees" hi="दुकानें और लोग" back="/more" />
      <p className="mb-3 text-sm text-slate-600">Everyone money has gone to, with every bill and photo. {rows.length} names · {formatINR(total)} paid in total.</p>
      {rows.length === 0 ? (
        <EmptyState en="No bills entered yet. Names appear here as bills are added." hi="अभी कोई बिल नहीं।" />
      ) : (
        <Card>
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/vendors/${r.id}`} className="flex min-h-[60px] items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="truncate font-semibold">{r.name}</span><Badge tone={r.kind === "LABOUR" ? "blue" : "slate"}>{titleCase(r.kind)}</Badge></div>
                    <div className="text-xs text-slate-500">
                      {r.bills} bill line{r.bills === 1 ? "" : "s"}{r.orders ? ` · ${r.orders} order${r.orders === 1 ? "" : "s"}${r.openOrders ? ` (${r.openOrders} open)` : ""}` : ""}{r.last ? ` · last ${formatDate(r.last)}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold">{formatINR(r.approved)}</div>
                    {r.waiting > 0 && <div className="text-xs text-amber-700">{formatINR(r.waiting)} waiting</div>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
