import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { consCloseSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertSiteAccess } from "@/lib/site";
import { adjustStock } from "@/lib/consumables";
import { istDateKey, dateKeyToDate } from "@/lib/format";
import { post } from "@/lib/ledger";
import { partyFor } from "@/lib/expenses";

/**
 * Close out an approved LOCAL_PURCHASE: bill photo + price are mandatory.
 * Posts the expense to petty cash and adds the quantity to stock.
 */
export const POST = withAuth<{ id: string }>("consumable.receive", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, consCloseSchema);
  const r = await prisma.consumableRequest.findFirst({ where: { id: params.id, voidedAt: null }, include: { item: true } });
  if (!r) throw new ApiError(404, "Request not found");
  assertSiteAccess(user, r.siteId);
  if (r.status !== "APPROVED" || r.fulfilment !== "LOCAL_PURCHASE") throw new ApiError(400, "Only approved local purchases can be closed here");
  await prisma.$transaction(async (tx) => {
    await tx.consumableRequest.update({ where: { id: r.id }, data: { status: "FULFILLED", purchaseBillUrl: body.billPhotoUrl, purchasePrice: body.price, purchasedAt: new Date() } });
    await adjustStock(tx, r.siteId, r.itemId, Number(r.qty));
    // The purchase was approved upstream, so it enters the books as an already-approved
    // one-line bill under the shop: the vendor ledger and expense list both see it.
    const vendor = await partyFor(tx, r.siteId, body.vendorName, "VENDOR");
    const category = (await tx.expenseCategory.findFirst({ where: { slug: "consumables", active: true } })) ?? (await tx.expenseCategory.findFirstOrThrow({ where: { active: true }, orderBy: { sortOrder: "desc" } }));
    const today = dateKeyToDate(istDateKey());
    const desc = `${r.item.name} × ${Number(r.qty)} ${r.item.unit}`;
    const bill = await tx.bill.create({
      data: {
        siteId: r.siteId, date: today, partyId: vendor.id, payeeText: vendor.name, billPhotoUrl: body.billPhotoUrl,
        paidFrom: "WORKER_CASH", note: `Local purchase against request ${r.id.slice(-6)}`, spentById: user.id, enteredById: user.id,
        lines: {
          create: [{
            siteId: r.siteId, date: today, amount: body.price, categoryId: category.id, entryType: "PURCHASE", paidFrom: "WORKER_CASH",
            description: desc, partyId: vendor.id, payeeText: vendor.name, billPhotoUrl: body.billPhotoUrl,
            spentById: user.id, enteredById: user.id, status: "APPROVED", decidedById: r.decidedById, decidedAt: new Date(), decisionNote: "Approved as a material request",
          }],
        },
      },
      include: { lines: { select: { id: true } } },
    });
    await tx.pettyCashTxn.create({
      data: {
        siteId: r.siteId,
        date: today,
        type: "EXPENSE",
        amount: body.price,
        category: "SMALL_PURCHASE",
        description: `Local purchase: ${desc}`,
        paidTo: vendor.name,
        billPhotoUrl: body.billPhotoUrl,
        consumableRequestId: r.id,
        expenseId: bill.lines[0].id,
        enteredById: user.id,
      },
    });
    // Bought locally out of the closer's own cash, so debit their ledger too.
    await post(tx, {
      siteId: r.siteId,
      holderId: user.id,
      kind: "EXPENSE",
      magnitude: body.price,
      sourceType: "consumable_request",
      sourceId: r.id,
      expenseId: bill.lines[0].id,
      memo: `Local purchase: ${r.item.name}`,
      createdById: user.id,
    });
    await audit({ userId: user.id, siteId: r.siteId, action: "UPDATE", entity: "ConsumableRequest", entityId: r.id, oldValues: r, newValues: { status: "FULFILLED", price: body.price }, ip }, tx);
  });
  return ok({ ok: true });
});
