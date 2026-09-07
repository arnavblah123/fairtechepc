import { withAuth, csvResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveSiteId } from "@/lib/site";
import { formatDate, titleCase } from "@/lib/format";

export const GET = withAuth("export.csv", async ({ user, req }) => {
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const txns = await prisma.pettyCashTxn.findMany({ where: { siteId, voidedAt: null }, orderBy: { date: "asc" }, include: { enteredBy: { select: { name: true } } } });
  let bal = 0;
  return csvResponse(
    "petty-cash.csv",
    txns.map((t) => {
      const amt = Number(t.amount);
      bal += t.type === "EXPENSE" ? -amt : amt;
      return {
        Date: formatDate(t.date),
        Type: t.type,
        Category: t.category ? titleCase(t.category) : "",
        Description: t.description,
        "Paid to": t.paidTo ?? "",
        In: t.type === "EXPENSE" ? "" : amt,
        Out: t.type === "EXPENSE" ? amt : "",
        Balance: bal,
        "Entered by": t.enteredBy.name,
        Bill: t.billPhotoUrl ?? "",
      };
    }),
  );
});
