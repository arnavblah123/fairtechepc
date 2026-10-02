import { z } from "zod";
import { withAuth, parseBody, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { withdrawExpense } from "@/lib/expenses";

export const POST = withAuth<{ id: string }>("expense.approve", async ({ user, req, params, ip }) => {
  const { reason } = await parseBody(req, z.object({ reason: z.string().trim().min(3, "Give a reason").max(300) }));
  await prisma.$transaction(async (tx) => {
    await withdrawExpense(tx, params.id, reason, user.id);
    const e = await tx.expense.findUniqueOrThrow({ where: { id: params.id }, select: { siteId: true } });
    await audit({ userId: user.id, siteId: e.siteId, action: "UPDATE", entity: "Expense", entityId: params.id, newValues: { status: "QUERIED", reason }, ip }, tx);
  });
  return ok({ ok: true });
});
