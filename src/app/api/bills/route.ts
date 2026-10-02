import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { billSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { assertEditableDate } from "@/lib/dates-guard";
import { dateKeyToDate } from "@/lib/format";
import { assertLineRules, partyFor } from "@/lib/expenses";

/**
 * One bill, several lines, entered together. Each line becomes an Expense so
 * approval and the cash ledger work per line; the bill carries the photo and
 * the payee, who gets a ledger entry under one name however it was typed.
 */
export const POST = withAuth("expense.create", async ({ user, req, ip }) => {
  const body = await parseBody(req, billSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  await assertEditableDate(user, siteId, "EXPENSES", body.date);
  // A bill with a photo is a purchase; one without is a payment to a person (no bill expected).
  const entryType = body.billPhotoUrl ? "PURCHASE" : "PAYMENT";
  const spentById = body.spentById && user.role === "SUPERADMIN" ? body.spentById : user.id;

  const bill = await prisma.$transaction(async (tx) => {
    const categories = await Promise.all(body.lines.map((l) => assertLineRules(tx, l)));
    const labour = categories.some((c) => c.requiresPerson);
    const party = await partyFor(tx, siteId, body.payeeText, labour ? "LABOUR" : "VENDOR");
    const created = await tx.bill.create({
      data: {
        siteId,
        date: dateKeyToDate(body.date),
        partyId: party.id,
        payeeText: body.payeeText.trim(),
        billNo: body.billNo || null,
        billPhotoUrl: body.billPhotoUrl || null,
        paidFrom: body.paidFrom,
        note: body.note || null,
        spentById,
        enteredById: user.id,
        lines: {
          create: body.lines.map((l) => ({
            siteId,
            date: dateKeyToDate(body.date),
            amount: l.amount,
            categoryId: l.categoryId,
            entryType,
            paidFrom: body.paidFrom,
            description: l.description,
            jobId: l.jobId || null,
            partyId: party.id,
            payeeText: body.payeeText.trim(),
            workerId: l.workerId || null,
            machineId: l.machineId || null,
            problem: l.problem || null,
            solution: l.solution || null,
            billPhotoUrl: body.billPhotoUrl || null,
            spentById,
            enteredById: user.id,
          })),
        },
      },
      include: { lines: { select: { id: true } } },
    });
    await audit({ userId: user.id, siteId, action: "CREATE", entity: "Bill", entityId: created.id, newValues: { payee: body.payeeText, lines: body.lines.length, total: body.lines.reduce((a, l) => a + l.amount, 0) }, ip }, tx);
    return created;
  });
  if (!bill) throw new ApiError(500, "Could not save the bill");
  return ok({ id: bill.id, lines: bill.lines.length }, 201);
});
