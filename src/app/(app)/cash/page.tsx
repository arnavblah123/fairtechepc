import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { CashBoard } from "./CashBoard";
import { balancesBySite } from "@/lib/ledger";
import { pettyBalance } from "@/lib/petty";
import { formatDateTime } from "@/lib/format";

export default async function CashPage() {
  const user = await requirePage("cash.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const [balances, wallet, people, recent] = await Promise.all([
    balancesBySite(site.id),
    pettyBalance(site.id),
    prisma.user.findMany({ where: { active: true, OR: [{ siteId: site.id }, { role: "SUPERADMIN" }] }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.cashLedger.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { holder: { select: { name: true } }, expense: { select: { description: true } } },
    }),
  ]);
  const onStreet = balances.reduce((a, b) => a + b.inHand, 0);
  return (
    <div>
      <PageHeader title="Cash in hand" hi="किसके पास कितना कैश" back="/more" />
      <CashBoard
        siteId={site.id}
        onStreet={onStreet}
        walletBalance={wallet}
        balances={balances}
        people={people}
        recent={recent.map((r) => ({
          id: r.id,
          holder: r.holder.name,
          kind: r.kind,
          amount: Number(r.amount),
          memo: r.memo ?? r.expense?.description ?? "",
          at: formatDateTime(r.createdAt),
          isReversal: r.sourceType === "reversal",
        }))}
      />
    </div>
  );
}
