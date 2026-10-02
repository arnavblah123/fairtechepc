import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { billDecideSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { decideExpense } from "@/lib/expenses";

/** Decide every undecided line of a bill in one tap. Already-approved lines are left alone. */
export const POST = withAuth<{ id: string }>("expense.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, billDecideSchema);
  const bill = await prisma.bill.findFirst({ where: { id: params.id, voidedAt: null }, include: { lines: { where: { voidedAt: null, status: { not: "APPROVED" } }, select: { id: true } } } });
  if (!bill) throw new ApiError(404, "Bill not found");
  if (bill.lines.length === 0) throw new ApiError(400, "Every line of this bill is already approved");
  await prisma.$transaction(async (tx) => {
    for (const line of bill.lines) await decideExpense(tx, line.id, body.decision, body.note || null, user.id);
    await audit({ userId: user.id, siteId: bill.siteId, action: body.decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "Bill", entityId: bill.id, newValues: { status: body.decision, lines: bill.lines.length, note: body.note }, ip }, tx);
  });
  return ok({ decided: bill.lines.length });
});
