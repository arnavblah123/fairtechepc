import "server-only";
import type { Prisma, ExpenseStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api";
import { post, reverse } from "./ledger";
import { istDateKey, dateKeyToDate } from "./format";
import { normalizePartyName } from "./parties";

type Tx = Prisma.TransactionClient;

/** Find or create the payee for a typed name. Same normalised name → same party. */
export async function partyFor(tx: Tx, siteId: string, name: string, kind: "LABOUR" | "VENDOR" | "OTHER" = "VENDOR") {
  const typed = name.trim();
  const normalizedName = normalizePartyName(name);
  const existing = await tx.party.findUnique({ where: { siteId_normalizedName: { siteId, normalizedName } } });
  if (!existing) return tx.party.create({ data: { siteId, name: typed, normalizedName, kind } });
  // "kamla hardware" typed in a hurry the first time, "Kamla Hardware" later: keep the better spelling.
  if (existing.name === existing.name.toLowerCase() && typed !== typed.toLowerCase()) {
    return tx.party.update({ where: { id: existing.id }, data: { name: typed } });
  }
  return existing;
}

/** Category rules, shared by single entries and bill lines. */
export async function assertLineRules(tx: Tx, line: { categoryId: string; workerId?: string | null; machineId?: string | null; problem?: string | null }) {
  const category = await tx.expenseCategory.findFirst({ where: { id: line.categoryId, active: true } });
  if (!category) throw new ApiError(400, "Category not found");
  if (category.requiresPerson && !line.workerId) throw new ApiError(400, `${category.name}: choose which worker this was for`);
  if (category.requiresMachine && !line.machineId) throw new ApiError(400, `${category.name}: choose which machine this was for`);
  if (category.requiresMachine && !(line.problem ?? "").trim()) throw new ApiError(400, `${category.name}: say what was wrong with the machine`);
  return category;
}

/**
 * Approve, query or reject one expense line. Approving is what moves money:
 * it debits the spender's cash ledger and books the amount in the site cash
 * book. Company-paid lines post nothing. Idempotent per approval attempt.
 */
export async function decideExpense(tx: Tx, expenseId: string, decision: ExpenseStatus, note: string | null, userId: string) {
  const e = await tx.expense.findFirst({ where: { id: expenseId, voidedAt: null }, include: { category: true } });
  if (!e) throw new ApiError(404, "Expense not found");
  if (e.status === "APPROVED") throw new ApiError(400, "Already approved. Withdraw the approval first.");
  if (decision !== "APPROVED" && !(note ?? "").trim()) {
    throw new ApiError(400, decision === "QUERIED" ? "Write what you want explained" : "Write why it is rejected");
  }
  await tx.expense.update({ where: { id: e.id }, data: { status: decision, decidedById: userId, decidedAt: new Date(), decisionNote: note || null } });
  if (decision !== "APPROVED" || e.paidFrom !== "WORKER_CASH") return;

  // A re-approval after a withdrawal must debit again, so the key carries an attempt number.
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
    createdById: userId,
    keySuffix: attempts > 0 ? String(attempts) : "",
  });
  const existing = await tx.pettyCashTxn.findUnique({ where: { expenseId: e.id } });
  if (existing) {
    if (existing.voidedAt) await tx.pettyCashTxn.update({ where: { id: existing.id }, data: { voidedAt: null, voidReason: null, amount: e.amount } });
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
        enteredById: userId,
      },
    });
  }
}

/** Take back an approval: reversing ledger row, cash-book row voided, line back to QUERIED. */
export async function withdrawExpense(tx: Tx, expenseId: string, reason: string, userId: string) {
  const e = await tx.expense.findFirst({ where: { id: expenseId, voidedAt: null }, include: { ledgerEntries: true } });
  if (!e) throw new ApiError(404, "Expense not found");
  if (e.status !== "APPROVED") throw new ApiError(400, "This expense is not approved");
  for (const entry of e.ledgerEntries.filter((l) => l.sourceType === "expense")) await reverse(tx, entry.id, userId, `Approval withdrawn: ${reason}`);
  const txn = await tx.pettyCashTxn.findUnique({ where: { expenseId: e.id } });
  if (txn && !txn.voidedAt) await tx.pettyCashTxn.update({ where: { id: txn.id }, data: { voidedAt: new Date(), voidReason: `Approval withdrawn: ${reason}` } });
  await tx.expense.update({ where: { id: e.id }, data: { status: "QUERIED", decidedById: userId, decidedAt: new Date(), decisionNote: reason } });
}

export { prisma };
