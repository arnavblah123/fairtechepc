import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { expenseDecideSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { post } from "@/lib/ledger";
import { istDateKey, dateKeyToDate } from "@/lib/format";

/**
 * Approve, query or reject a spend.
 *
 * Approving is what moves money: it debits the spender's cash ledger and books
 * the amount against the site wallet. Company-paid spending is approved the
 * same way but posts nothing, because that cash never passed through anyone's
 * hands — it only counts toward the job's cost.
 *
 * Posting is idempotent, so a double-tap or a retried request debits once.
 */
export const POST = withAuth<{ id: string }>("expense.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, expenseDecideSchema);
  const e = await prisma.expense.findFirst({ where: { id: params.id, voidedAt: null }, include: { category: true } });
  if (!e) throw new ApiError(404, "Expense not found");
  if (e.status === "APPROVED") throw new ApiError(400, "Already approved. Withdraw the approval first.");
  if (body.decision !== "APPROVED" && !(body.note ?? "").trim()) {
    throw new ApiError(400, body.decision === "QUERIED" ? "Write what you want explained" : "Write why it is rejected");
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: e.id },
      data: { status: body.decision, decidedById: user.id, decidedAt: new Date(), decisionNote: body.note || null },
    });

    if (body.decision === "APPROVED" && e.paidFrom === "WORKER_CASH") {
      // A re-approval after a withdrawal must debit again, so the key carries an
      // attempt number: it is still idempotent per attempt, but is not mistaken
      // for a duplicate of the debit it replaces.
      const attempts = await tx.cashLedger.count({ where: { expenseId: e.id, sourceType: "expense" } });
      await post(tx, {
        siteId: e.siteId,
        holderId: e.spentById,
        kind: "EXPENSE",
        magnitude: Number(e.amount),
        sourceType: "expense",
        sourceId: e.id,
        expenseId: e.id,
        memo: `${e.category.name}: ${e.description}`,
        createdById: user.id,
        keySuffix: attempts > 0 ? String(attempts) : "",
      });
      // Mirror it in the site cash book so the wallet statement stays complete.
      // A withdrawn approval voided that row; approving again revives it.
      const existing = await tx.pettyCashTxn.findUnique({ where: { expenseId: e.id } });
      if (existing) {
        if (existing.voidedAt) {
          await tx.pettyCashTxn.update({ where: { id: existing.id }, data: { voidedAt: null, voidReason: null, amount: e.amount } });
        }
      } else {
        await tx.pettyCashTxn.create({
          data: {
            siteId: e.siteId,
            date: dateKeyToDate(istDateKey()),
            type: "EXPENSE",
            amount: e.amount,
            description: `${e.category.name}: ${e.description}`,
            paidTo: e.payeeText,
            billPhotoUrl: e.billPhotoUrl,
            expenseId: e.id,
            enteredById: user.id,
          },
        });
      }
    }

    await audit(
      { userId: user.id, siteId: e.siteId, action: body.decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "Expense", entityId: e.id, oldValues: { status: e.status }, newValues: { status: body.decision, note: body.note }, ip },
      tx,
    );
  });
  return ok({ ok: true });
});
