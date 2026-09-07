import { getSessionUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/Card";
import { AdvancesBoard } from "./AdvancesBoard";

export default async function AdvancesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user.role, "advance.approve") && !can(user.role, "advance.request")) notFound();
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const isApprover = can(user.role, "advance.approve");
  const [advances, workers] = await Promise.all([
    prisma.advance.findMany({
      where: { siteId: site.id, voidedAt: null, ...(isApprover ? {} : { requestedById: user.id }) },
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      take: 60,
      include: { worker: { select: { code: true, name: true } }, requestedBy: { select: { name: true } } },
    }),
    prisma.worker.findMany({ where: { siteId: site.id, active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  return (
    <AdvancesBoard
      canRequest={can(user.role, "advance.request")}
      canApprove={isApprover}
      showAmounts={isApprover}
      workers={workers}
      advances={advances.map((a) => ({
        id: a.id, worker: `${a.worker.code} ${a.worker.name}`, amount: Number(a.amount), reason: a.reason,
        status: a.status, by: a.requestedBy.name, deducted: !!a.wageSheetId, note: a.decisionNote,
      }))}
    />
  );
}
