import "server-only";
import type { ExpenseStatus, Fulfilment, Issue } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api";
import { audit } from "./audit";
import { decideExpense } from "./expenses";

/**
 * The approve / reject logic behind every one-tap button, as plain functions.
 *
 * The API routes (pressed from the app) and the owner-dashboard feed
 * (`/api/admin-feed/act`) both call these, so a decision taken from either
 * place writes the same rows: status, decidedBy, ledger postings, audit log.
 * Each throws ApiError(404) when the record is gone and ApiError(400,
 * "Already decided") when it was decided before, so a double tap is harmless.
 */

export type Actor = { id: string; ip?: string | null };
export type Decision = "APPROVED" | "REJECTED";

export const ALREADY_DECIDED = "Already decided";

/** Approved advances auto-deduct from the worker's next wage sheet. */
export async function decideAdvance(id: string, decision: Decision, note: string | null, actor: Actor) {
  const before = await prisma.advance.findFirst({ where: { id, voidedAt: null } });
  if (!before) throw new ApiError(404, "Advance not found");
  if (before.status !== "PENDING") throw new ApiError(400, ALREADY_DECIDED);
  const after = await prisma.advance.update({
    where: { id: before.id },
    data: { status: decision, decidedById: actor.id, decidedAt: new Date(), decisionNote: note || null, paidAt: decision === "APPROVED" ? new Date() : null },
  });
  await audit({ userId: actor.id, siteId: after.siteId, action: decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "Advance", entityId: after.id, oldValues: before, newValues: after, ip: actor.ip });
  return after;
}

export async function decidePettyRequest(id: string, decision: Decision, note: string | null, actor: Actor) {
  const before = await prisma.pettyCashRequest.findFirst({ where: { id, voidedAt: null } });
  if (!before) throw new ApiError(404, "Request not found");
  if (before.status !== "PENDING") throw new ApiError(400, ALREADY_DECIDED);
  const after = await prisma.pettyCashRequest.update({
    where: { id: before.id },
    data: { status: decision, decidedById: actor.id, decidedAt: new Date(), decisionNote: note || null },
  });
  await audit({ userId: actor.id, siteId: after.siteId, action: decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "PettyCashRequest", entityId: after.id, oldValues: before, newValues: after, ip: actor.ip });
  return after;
}

/** Superadmin approves one consumable line (choosing factory, purchase desk or local purchase) or rejects it. */
export async function decideConsumableRequest(id: string, decision: Decision, fulfilment: Fulfilment | null | undefined, note: string | null, actor: Actor) {
  const before = await prisma.consumableRequest.findFirst({ where: { id, voidedAt: null } });
  if (!before) throw new ApiError(404, "Request not found");
  if (before.status !== "PENDING") throw new ApiError(400, ALREADY_DECIDED);
  // Approving a request for a site-added item accepts that item into the master.
  if (decision === "APPROVED") await prisma.consumableItem.updateMany({ where: { id: before.itemId, approved: false }, data: { approved: true } });
  const after = await prisma.consumableRequest.update({
    where: { id: before.id },
    data: { status: decision, fulfilment: decision === "APPROVED" ? fulfilment : null, decidedById: actor.id, decidedAt: new Date(), decisionNote: note || null },
  });
  await audit({ userId: actor.id, siteId: after.siteId, action: decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "ConsumableRequest", entityId: after.id, oldValues: before, newValues: after, ip: actor.ip });
  return after;
}

/** Decide every still-pending line of an indent at once. Lines already decided are left alone. */
export async function decideIndent(id: string, decision: Decision, fulfilment: Fulfilment | null | undefined, note: string | null, actor: Actor) {
  const indent = await prisma.materialIndent.findFirst({ where: { id, voidedAt: null }, include: { lines: { where: { status: "PENDING", voidedAt: null }, select: { id: true, itemId: true } } } });
  if (!indent) throw new ApiError(404, "Indent not found");
  if (indent.lines.length === 0) throw new ApiError(400, "Nothing left to decide on this indent");
  await prisma.$transaction(async (tx) => {
    if (decision === "APPROVED") {
      await tx.consumableItem.updateMany({ where: { id: { in: indent.lines.map((l) => l.itemId) }, approved: false }, data: { approved: true } });
    }
    await tx.consumableRequest.updateMany({
      where: { id: { in: indent.lines.map((l) => l.id) } },
      data: { status: decision, fulfilment: decision === "APPROVED" ? fulfilment : null, decidedById: actor.id, decidedAt: new Date(), decisionNote: note || null },
    });
    await audit({ userId: actor.id, siteId: indent.siteId, action: decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "MaterialIndent", entityId: indent.id, newValues: { status: decision, fulfilment, lines: indent.lines.length }, ip: actor.ip }, tx);
  });
  return { decided: indent.lines.length };
}

/** Superadmin accepts a site-added item into the master, or rejects it (deactivates). */
export async function decideItem(id: string, decision: Decision, note: string | null, actor: Actor) {
  const item = await prisma.consumableItem.findUnique({ where: { id } });
  if (!item) throw new ApiError(404, "Item not found");
  const after = await prisma.consumableItem.update({
    where: { id: item.id },
    data: decision === "APPROVED" ? { approved: true } : { approved: false, active: false },
  });
  await audit({ userId: actor.id, action: decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "ConsumableItem", entityId: item.id, oldValues: { approved: item.approved, active: item.active }, newValues: { approved: after.approved, active: after.active, note }, ip: actor.ip });
  return after;
}

/** Approve, query or reject one expense line: ledger posting + cash book + audit, in one transaction. */
export async function decideExpenseLine(id: string, decision: ExpenseStatus, note: string | null, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    await decideExpense(tx, id, decision, note, actor.id);
    const e = await tx.expense.findUniqueOrThrow({ where: { id }, select: { siteId: true } });
    await audit({ userId: actor.id, siteId: e.siteId, action: decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "Expense", entityId: id, newValues: { status: decision, note }, ip: actor.ip }, tx);
  });
}

/** Decide every undecided line of a bill in one tap. Already-approved lines are left alone. */
export async function decideBill(id: string, decision: ExpenseStatus, note: string | null, actor: Actor) {
  const bill = await prisma.bill.findFirst({ where: { id, voidedAt: null }, include: { lines: { where: { voidedAt: null, status: { not: "APPROVED" } }, select: { id: true } } } });
  if (!bill) throw new ApiError(404, "Bill not found");
  if (bill.lines.length === 0) throw new ApiError(400, "Every line of this bill is already approved");
  await prisma.$transaction(async (tx) => {
    for (const line of bill.lines) await decideExpense(tx, line.id, decision, note, actor.id);
    await audit({ userId: actor.id, siteId: bill.siteId, action: decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "Bill", entityId: bill.id, newValues: { status: decision, lines: bill.lines.length, note }, ip: actor.ip }, tx);
  });
  return { decided: bill.lines.length };
}

export type IssueAction = "ACKNOWLEDGE" | "IN_PROGRESS" | "RESOLVE";

/**
 * Status transitions on an issue. Acknowledge = head office has seen it.
 * Resolve needs a note. Role checks stay in the route; this is the record change.
 */
export async function transitionIssue(before: Issue, action: IssueAction, note: string | null, actor: Actor) {
  if (before.status === "RESOLVED") throw new ApiError(400, "Already resolved");
  if (action === "RESOLVE" && !(note ?? "").trim()) throw new ApiError(400, "Write what was done to resolve it");
  const after = await prisma.issue.update({
    where: { id: before.id },
    data:
      action === "ACKNOWLEDGE"
        ? { status: "ACKNOWLEDGED", acknowledgedAt: new Date() }
        : action === "IN_PROGRESS"
          ? { status: "IN_PROGRESS", acknowledgedAt: before.acknowledgedAt ?? new Date() }
          : { status: "RESOLVED", resolvedAt: new Date(), resolutionNote: note, closedById: actor.id },
  });
  await audit({ userId: actor.id, siteId: after.siteId, action: action === "RESOLVE" ? "APPROVE" : "UPDATE", entity: "Issue", entityId: after.id, oldValues: { status: before.status }, newValues: { status: after.status, note }, ip: actor.ip });
  return after;
}
