import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { consCloseSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertSiteAccess } from "@/lib/site";
import { adjustStock } from "@/lib/consumables";
import { istDateKey, dateKeyToDate } from "@/lib/format";

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
    await tx.pettyCashTxn.create({
      data: {
        siteId: r.siteId,
        date: dateKeyToDate(istDateKey()),
        type: "EXPENSE",
        amount: body.price,
        category: "SMALL_PURCHASE",
        description: `Local purchase: ${r.item.name} × ${Number(r.qty)} ${r.item.unit}`,
        billPhotoUrl: body.billPhotoUrl,
        consumableRequestId: r.id,
        enteredById: user.id,
      },
    });
    await audit({ userId: user.id, siteId: r.siteId, action: "UPDATE", entity: "ConsumableRequest", entityId: r.id, oldValues: r, newValues: { status: "FULFILLED", price: body.price }, ip }, tx);
  });
  return ok({ ok: true });
});
