import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { assertSiteAccess } from "@/lib/site";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card, Stat } from "@/components/ui/Card";
import { PhotoLink } from "@/components/forms/PhotoLink";
import { formatDate, formatINR, formatNum, titleCase } from "@/lib/format";
import { toPaise, toRupees } from "@/lib/money";

const TONE = { PENDING: "amber", APPROVED: "green", QUERIED: "blue", REJECTED: "red" } as const;

/** One payee's full ledger: every bill with its photo and lines, every purchase order, running totals. */
export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("vendor.view");
  const { id } = await params;
  const party = await prisma.party.findUnique({
    where: { id },
    include: {
      bills: {
        where: { voidedAt: null },
        orderBy: { date: "desc" },
        include: { lines: { where: { voidedAt: null }, include: { category: { select: { name: true } }, job: { select: { jobNumber: true } } } }, spentBy: { select: { name: true } } },
      },
      expenses: { where: { voidedAt: null, billId: null }, orderBy: { date: "desc" }, include: { category: { select: { name: true } }, spentBy: { select: { name: true } }, job: { select: { jobNumber: true } } } },
      orders: {
        where: { voidedAt: null },
        orderBy: { orderedAt: "desc" },
        include: { item: { select: { name: true, unit: true } }, dispatches: { where: { voidedAt: null }, select: { receivedAt: true, receivedQty: true, photoUrl: true } } },
      },
    },
  });
  if (!party) notFound();
  try {
    assertSiteAccess(user, party.siteId);
  } catch {
    notFound();
  }
  const showPrices = can(user.role, "money.view") || user.role === "PURCHASE";
  const allLines = [...party.bills.flatMap((b) => b.lines), ...party.expenses];
  const approved = toRupees(allLines.filter((l) => l.status === "APPROVED").reduce((a, l) => a + toPaise(l.amount), 0));
  const waiting = toRupees(allLines.filter((l) => l.status === "PENDING" || l.status === "QUERIED").reduce((a, l) => a + toPaise(l.amount), 0));

  return (
    <div className="space-y-4">
      <PageHeader title={party.name} hi={titleCase(party.kind)} back="/vendors" />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Paid (approved)" hi="भुगतान" value={formatINR(approved)} tone="green" />
        <Stat label="Waiting approval" hi="मंज़ूरी बाकी" value={formatINR(waiting)} tone={waiting > 0 ? "amber" : "slate"} />
      </div>

      <Card title={`Bills (${party.bills.length + party.expenses.length})`} hi="बिल">
        {party.bills.length === 0 && party.expenses.length === 0 ? (
          <p className="text-sm text-slate-500">No bills yet.</p>
        ) : (
          <ul className="divide-y">
            {party.bills.map((b) => {
              const total = toRupees(b.lines.reduce((a, l) => a + toPaise(l.amount), 0));
              const st = b.lines.every((l) => l.status === "APPROVED") ? "APPROVED" : (b.lines.find((l) => l.status !== "APPROVED")?.status ?? "APPROVED");
              return (
                <li key={b.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">{formatDate(b.date)}{b.billNo ? ` · bill ${b.billNo}` : ""}</div>
                      <div className="text-xs text-slate-500">entered by {b.spentBy.name}{b.paidFrom === "COMPANY_DIRECT" ? " · company paid" : ""}</div>
                    </div>
                    <div className="shrink-0 text-right"><div className="font-bold">{formatINR(total)}</div><Badge tone={TONE[st as keyof typeof TONE]}>{st}</Badge></div>
                  </div>
                  <div className="mt-1"><PhotoLink url={b.billPhotoUrl} size="h-16 w-16" /></div>
                  <ul className="mt-1 text-sm">
                    {b.lines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-2 py-0.5"><span className="min-w-0 truncate">{l.description} <span className="text-xs text-slate-500">· {l.category.name}{l.job ? ` · ${l.job.jobNumber}` : ""}</span></span><span className="shrink-0">{formatINR(l.amount)}</span></li>
                    ))}
                  </ul>
                </li>
              );
            })}
            {party.expenses.map((l) => (
              <li key={l.id} className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="font-semibold">{l.description}</div><div className="text-xs text-slate-500">{formatDate(l.date)} · {l.category.name}{l.job ? ` · ${l.job.jobNumber}` : ""} · {l.spentBy.name}</div></div>
                  <div className="shrink-0 text-right"><div className="font-bold">{formatINR(l.amount)}</div><Badge tone={TONE[l.status]}>{l.status}</Badge></div>
                </div>
                <div className="mt-1"><PhotoLink url={l.billPhotoUrl} size="h-16 w-16" /></div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {party.orders.length > 0 && (
        <Card title={`Purchase orders (${party.orders.length})`} hi="ऑर्डर">
          <ul className="divide-y text-sm">
            {party.orders.map((o) => (
              <li key={o.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate">{o.item.name} · {formatNum(o.qty)} {o.item.unit}{o.poNumber ? ` · PO ${o.poNumber}` : ""}</span>
                  <Badge tone={o.status === "FULFILLED" ? "green" : "blue"}>{o.status}</Badge>
                </div>
                <div className="text-xs text-slate-500">
                  {o.orderedAt ? `ordered ${formatDate(o.orderedAt.toISOString().slice(0, 10))}` : ""}{o.expectedDate ? ` · due ${formatDate(o.expectedDate)}` : ""}
                  {showPrices && o.unitPrice ? ` · ${formatINR(o.unitPrice)}/${o.item.unit}` : ""}
                  {o.dispatches.some((d) => d.receivedAt) ? ` · received ${formatNum(o.dispatches.reduce((a, d) => a + Number(d.receivedQty ?? 0), 0))} ${o.item.unit}` : ""}
                </div>
                {o.dispatches.map((d, i) => d.photoUrl && <span key={i} className="mr-1 inline-block"><PhotoLink url={d.photoUrl} size="h-12 w-12" /></span>)}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
