import { withAuth, parseBody, ok } from "@/lib/api";
import { expenseDecideSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { decideExpense } from "@/lib/expenses";

export const POST = withAuth<{ id: string }>("expense.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, expenseDecideSchema);
  await prisma.$transaction(async (tx) => {
    await decideExpense(tx, params.id, body.decision, body.note || null, user.id);
    const e = await tx.expense.findUniqueOrThrow({ where: { id: params.id }, select: { siteId: true } });
    await audit({ userId: user.id, siteId: e.siteId, action: body.decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "Expense", entityId: params.id, newValues: { status: body.decision, note: body.note }, ip }, tx);
  });
  return ok({ ok: true });
});
