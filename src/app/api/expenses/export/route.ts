import { withAuth, csvResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveSiteId } from "@/lib/site";
import { formatDate, titleCase } from "@/lib/format";

export const GET = withAuth("export.csv", async ({ user, req }) => {
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const rows = await prisma.expense.findMany({
    where: { siteId, voidedAt: null },
    orderBy: { date: "asc" },
    include: {
      category: { select: { name: true } },
      spentBy: { select: { name: true } },
      job: { select: { jobNumber: true } },
      worker: { select: { code: true, name: true } },
      machine: { select: { machineNumber: true } },
      decidedBy: { select: { name: true } },
    },
  });
  return csvResponse(
    "expenses.csv",
    rows.map((e) => ({
      Date: formatDate(e.date),
      Amount: Number(e.amount),
      Category: e.category.name,
      Description: e.description,
      "Paid to": e.payeeText ?? "",
      Type: titleCase(e.entryType),
      "Paid from": e.paidFrom === "WORKER_CASH" ? "Site cash" : "Company direct",
      "Spent by": e.spentBy.name,
      Job: e.job?.jobNumber ?? "",
      Worker: e.worker ? `${e.worker.code} ${e.worker.name}` : "",
      Machine: e.machine?.machineNumber ?? "",
      Fault: e.problem ?? "",
      Fix: e.solution ?? "",
      Status: e.status,
      "Decided by": e.decidedBy?.name ?? "",
      Bill: e.billPhotoUrl ?? "",
    })),
  );
});
