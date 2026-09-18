import { z } from "zod";
import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { reverse } from "@/lib/ledger";

/**
 * Take back an approval. The money goes back to the spender through a reversing
 * row rather than by deleting history; re-approving debits again with a fresh
 * key, so it is not swallowed as a duplicate of the debit it replaces.
 */
export const POST = withAuth<{ id: string }>("expense.approve", async ({ user, req, params, ip }) => {
  const { reason } = await parseBody(req, z.object({ reason: z.string().trim().min(3, "Give a reason").max(300) }));
  const e = await prisma.expense.findFirst({ where: { id: params.id, voidedAt: null }, include: { ledgerEntries: true } });
  if (!e) throw new ApiError(404, "Expense not found");
  if (e.status !== "APPROVED") throw new ApiError(400, "This expense is not approved");

  await prisma.$transaction(async (tx) => {
    for (const entry of e.ledgerEntries.filter((l) => l.sourceType === "expense")) {
      await reverse(tx, entry.id, user.id, `Approval withdrawn: ${reason}`);
    }
    const txn = await tx.pettyCashTxn.findUnique({ where: { expenseId: e.id } });
    if (txn && !txn.voidedAt) {
      await tx.pettyCashTxn.update({ where: { id: txn.id }, data: { voidedAt: new Date(), voidReason: `Approval withdrawn: ${reason}` } });
    }
    await tx.expense.update({ where: { id: e.id }, data: { status: "QUERIED", decidedById: user.id, decidedAt: new Date(), decisionNote: reason } });
    await audit({ userId: user.id, siteId: e.siteId, action: "UPDATE", entity: "Expense", entityId: e.id, oldValues: { status: "APPROVED" }, newValues: { status: "QUERIED", reason }, ip }, tx);
  });
  return ok({ ok: true });
});
