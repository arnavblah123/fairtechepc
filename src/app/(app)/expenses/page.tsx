import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { ExpenseList } from "./ExpenseList";
import { balanceOf, pendingSpendOf } from "@/lib/ledger";
import { dateToKey } from "@/lib/format";
import { ExportLink } from "@/components/forms/ExportLink";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePage("expense.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const sp = await searchParams;
  const status = ["PENDING", "APPROVED", "QUERIED", "REJECTED"].includes(sp.status ?? "") ? sp.status : undefined;
  // Everyone on site sees the site's bills; this is the shared record of where the money went.
  const [expenses, balance, pending] = await Promise.all([
    prisma.expense.findMany({
      where: { siteId: site.id, voidedAt: null, ...(status ? { status: status as "PENDING" } : {}) },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        category: { select: { name: true } },
        spentBy: { select: { name: true } },
        job: { select: { jobNumber: true } },
        worker: { select: { name: true } },
        machine: { select: { machineNumber: true } },
        party: { select: { id: true, name: true } },
        bill: { select: { id: true, billNo: true, billPhotoUrl: true } },
      },
    }),
    balanceOf(user.id),
    pendingSpendOf(user.id),
  ]);

  return (
    <div>
      <PageHeader title="Bills & expenses" hi="बिल और खर्च" back="/more" action={can(user.role, "export.csv") ? <ExportLink href={`/api/expenses/export?siteId=${site.id}`} /> : undefined} />
      <ExpenseList
        canCreate={can(user.role, "expense.create")}
        canApprove={can(user.role, "expense.approve")}
        canDelete={can(user.role, "record.delete")}
        showOwnCash={can(user.role, "expense.create")}
        inHand={balance.inHand}
        pending={pending}
        activeStatus={status ?? null}
        expenses={expenses.map((e) => ({
          id: e.id,
          billId: e.bill?.id ?? null,
          billNo: e.bill?.billNo ?? null,
          date: dateToKey(e.date),
          amount: Number(e.amount),
          category: e.category.name,
          description: e.description,
          entryType: e.entryType,
          paidFrom: e.paidFrom,
          payee: e.payeeText,
          partyId: e.party?.id ?? null,
          status: e.status,
          spentBy: e.spentBy.name,
          job: e.job?.jobNumber ?? null,
          worker: e.worker?.name ?? null,
          machine: e.machine?.machineNumber ?? null,
          problem: e.problem,
          bill: e.billPhotoUrl ?? e.bill?.billPhotoUrl ?? null,
          note: e.decisionNote,
        }))}
      />
    </div>
  );
}
