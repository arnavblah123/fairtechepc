import "server-only";
import type { LedgerKind, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api";
import { toPaise, toRupees } from "./money";

/**
 * Cash-in-hand maths.
 *
 * A person's balance is never a stored column — it is always the sum of an
 * append-only ledger. Nothing here edits or deletes a row: a mistake is
 * corrected by posting a reversing row, so every figure self-corrects.
 *
 * Sign convention, from the holder's point of view:
 *   ADVANCE / TOPUP  +  cash issued to them
 *   EXPENSE / RETURN -  cash that left their hands
 *   ADJUSTMENT      +/- a superadmin correction
 */

const CREDIT_KINDS: readonly LedgerKind[] = ["ADVANCE", "TOPUP"];

export type Balance = {
  /** Cash issued to this person, net of reversals. */
  advanced: number;
  /** Approved spending charged against their cash. Positive. */
  spent: number;
  /** Cash handed back to head office. Positive. */
  returned: number;
  /** Net corrections. Signed. */
  adjustment: number;
  /** What they should physically be holding. */
  inHand: number;
  entryCount: number;
  /** A negative balance is impossible in real life and means something was recorded wrong. */
  needsReconcile: boolean;
};

export const EMPTY_BALANCE: Balance = {
  advanced: 0,
  spent: 0,
  returned: 0,
  adjustment: 0,
  inHand: 0,
  entryCount: 0,
  needsReconcile: false,
};

/** Applies the sign convention to a magnitude collected by the UI. */
export function signedAmount(kind: LedgerKind, magnitude: number): number {
  if (kind === "ADJUSTMENT") return magnitude;
  if (magnitude < 0) throw new ApiError(400, `A ${kind.toLowerCase()} must be a positive amount`);
  return CREDIT_KINDS.includes(kind) ? magnitude : -magnitude;
}

/** Folds a set of rows into a balance. Pure and order-independent. */
export function computeBalance(entries: readonly { kind: LedgerKind; amount: unknown }[]): Balance {
  let advanced = 0, spentSigned = 0, returnedSigned = 0, adjustment = 0;
  for (const e of entries) {
    const p = toPaise(e.amount);
    if (e.kind === "ADVANCE" || e.kind === "TOPUP") advanced += p;
    else if (e.kind === "EXPENSE") spentSigned += p;
    else if (e.kind === "RETURN") returnedSigned += p;
    else adjustment += p;
  }
  const spent = -spentSigned;
  const returned = -returnedSigned;
  const inHand = advanced - spent - returned + adjustment;
  return {
    advanced: toRupees(advanced),
    spent: toRupees(spent),
    returned: toRupees(returned),
    adjustment: toRupees(adjustment),
    inHand: toRupees(inHand),
    entryCount: entries.length,
    needsReconcile: inHand < 0,
  };
}

/**
 * The idempotency key for a posting. The unique index on it is what stops a
 * double-tap or a retried request from debiting anyone twice.
 */
export function postingKey(sourceType: string, sourceId: string, kind: LedgerKind, suffix = ""): string {
  return `${sourceType}:${sourceId}:${kind}${suffix ? ":" + suffix : ""}`;
}

type Tx = Prisma.TransactionClient;

/** Post one row. Returns null when the same posting already exists. */
export async function post(
  tx: Tx,
  params: {
    siteId: string;
    holderId: string;
    kind: LedgerKind;
    magnitude: number;
    sourceType: string;
    sourceId?: string | null;
    expenseId?: string | null;
    memo?: string | null;
    createdById: string;
    keySuffix?: string;
  },
) {
  const key = postingKey(params.sourceType, params.sourceId ?? "manual", params.kind, params.keySuffix);
  const existing = await tx.cashLedger.findUnique({ where: { postingKey: key } });
  if (existing) return null;
  return tx.cashLedger.create({
    data: {
      siteId: params.siteId,
      holderId: params.holderId,
      kind: params.kind,
      amount: signedAmount(params.kind, params.magnitude),
      sourceType: params.sourceType,
      sourceId: params.sourceId ?? null,
      postingKey: key,
      expenseId: params.expenseId ?? null,
      memo: params.memo ?? null,
      createdById: params.createdById,
    },
  });
}

/**
 * Cancel a posting with an equal and opposite row of the same kind, so the
 * advanced/spent breakdown stays correct and not just the total.
 */
export async function reverse(tx: Tx, entryId: string, createdById: string, memo: string) {
  const row = await tx.cashLedger.findUnique({ where: { id: entryId }, include: { reversedBy: true } });
  if (!row) throw new ApiError(404, "Ledger entry not found");
  if (row.reversedBy) return null; // already cancelled
  return tx.cashLedger.create({
    data: {
      siteId: row.siteId,
      holderId: row.holderId,
      kind: row.kind,
      amount: toRupees(-toPaise(row.amount)),
      sourceType: "reversal",
      sourceId: row.sourceId,
      postingKey: postingKey("reversal", row.id, row.kind),
      expenseId: row.expenseId,
      reversesId: row.id,
      memo,
      createdById,
    },
  });
}

/** Balance for one person. */
export async function balanceOf(holderId: string): Promise<Balance> {
  const rows = await prisma.cashLedger.findMany({ where: { holderId }, select: { kind: true, amount: true } });
  return computeBalance(rows);
}

/** Everyone currently holding site cash, most cash first. */
export async function balancesBySite(siteId: string) {
  const rows = await prisma.cashLedger.findMany({
    where: { siteId },
    select: { kind: true, amount: true, holderId: true, holder: { select: { name: true, role: true } } },
  });
  const byHolder = new Map<string, { name: string; role: string; entries: { kind: LedgerKind; amount: unknown }[] }>();
  for (const r of rows) {
    const b = byHolder.get(r.holderId) ?? { name: r.holder.name, role: r.holder.role, entries: [] };
    b.entries.push({ kind: r.kind, amount: r.amount });
    byHolder.set(r.holderId, b);
  }
  return [...byHolder.entries()]
    .map(([holderId, v]) => ({ holderId, name: v.name, role: v.role, ...computeBalance(v.entries) }))
    .filter((b) => b.entryCount > 0)
    .sort((a, b) => b.inHand - a.inHand);
}

/** Spending submitted but not yet approved, which the holder has already paid out. */
export async function pendingSpendOf(holderId: string): Promise<number> {
  const rows = await prisma.expense.findMany({
    where: { spentById: holderId, status: { in: ["PENDING", "QUERIED"] }, paidFrom: "WORKER_CASH", voidedAt: null },
    select: { amount: true },
  });
  return toRupees(rows.reduce((a, r) => a + toPaise(r.amount), 0));
}
