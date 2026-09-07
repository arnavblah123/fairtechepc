import { withAuth, parseBody, ok } from "@/lib/api";
import { expenseSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { assertEditableDate } from "@/lib/dates-guard";
import { dateKeyToDate } from "@/lib/format";

/** In-charge records an expense. Bill photo mandatory; balance reduces automatically. */
export const POST = withAuth("petty.expense", async ({ user, req, ip }) => {
  const body = await parseBody(req, expenseSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  await assertEditableDate(user, siteId, "EXPENSES", body.date);
  const t = await prisma.pettyCashTxn.create({
    data: {
      siteId,
      date: dateKeyToDate(body.date),
      type: "EXPENSE",
      amount: body.amount,
      category: body.category,
      description: body.description,
      paidTo: body.paidTo || null,
      billPhotoUrl: body.billPhotoUrl,
      enteredById: user.id,
    },
  });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "PettyCashTxn", entityId: t.id, newValues: t, ip });
  return ok({ id: t.id }, 201);
});
