import { requirePage } from "@/lib/page";
import { getSessionUser } from "@/lib/auth";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/Card";
import { PettyBoard } from "./PettyBoard";
import { pettyBalance, pettyBurnRate } from "@/lib/petty";
import { dateToKey, istDateKey } from "@/lib/format";

export default async function PettyCashPage() {
  const user = (await getSessionUser())!;
  await requirePage();
  // Money screens: full view for superadmin + in-charge; supervisors get a request-only view.
  const full = can(user.role, "money.view") || can(user.role, "petty.expense");
  if (!full && !can(user.role, "petty.request")) notFound();
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;

  const [requests, txns, recons, balance, burn] = full
    ? await Promise.all([
        prisma.pettyCashRequest.findMany({ where: { siteId: site.id, voidedAt: null }, orderBy: { requestedAt: "desc" }, take: 30, include: { requestedBy: { select: { name: true } } } }),
        prisma.pettyCashTxn.findMany({ where: { siteId: site.id, voidedAt: null }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 50, include: { enteredBy: { select: { name: true } } } }),
        prisma.pettyCashReconciliation.findMany({ where: { siteId: site.id }, orderBy: { month: "desc" }, take: 6 }),
        pettyBalance(site.id),
        pettyBurnRate(site.id),
      ])
    : await Promise.all([
        prisma.pettyCashRequest.findMany({ where: { siteId: site.id, voidedAt: null, requestedById: user.id }, orderBy: { requestedAt: "desc" }, take: 20, include: { requestedBy: { select: { name: true } } } }),
        Promise.resolve([]),
        Promise.resolve([]),
        Promise.resolve(0),
        Promise.resolve(0),
      ]);

  return (
    <PettyBoard
      siteId={site.id}
      today={istDateKey()}
      full={full}
      canApprove={can(user.role, "petty.approve")}
      canExpense={can(user.role, "petty.expense")}
      canRequest={can(user.role, "petty.request")}
      balance={balance}
      burnRate={burn}
      threshold={full ? Number((await prisma.site.findUniqueOrThrow({ where: { id: site.id }, select: { pettyCashThreshold: true } })).pettyCashThreshold) : 0}
      requests={requests.map((r) => ({ id: r.id, amount: Number(r.amount), reason: r.reason, urgency: r.urgency, status: r.status, by: r.requestedBy.name, mode: r.sentMode, note: r.decisionNote }))}
      txns={txns.map((t) => ({ id: t.id, date: dateToKey(t.date), type: t.type, amount: Number(t.amount), category: t.category, description: t.description, paidTo: t.paidTo, bill: t.billPhotoUrl, by: t.enteredBy.name }))}
      recons={recons.map((r) => ({ month: dateToKey(r.month), physical: Number(r.physicalCash), app: Number(r.appBalance), note: r.note }))}
    />
  );
}
