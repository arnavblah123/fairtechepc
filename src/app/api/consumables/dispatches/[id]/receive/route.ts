import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { consReceiveSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertSiteAccess } from "@/lib/site";
import { adjustStock } from "@/lib/consumables";

/** Site acknowledges receipt; short receipts are flagged. Stock goes up by the RECEIVED qty. */
export const POST = withAuth<{ id: string }>("consumable.receive", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, consReceiveSchema);
  const d = await prisma.consumableDispatch.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!d) throw new ApiError(404, "Dispatch not found");
  assertSiteAccess(user, d.siteId);
  if (d.receivedAt) throw new ApiError(400, "Already acknowledged");
  const short = body.receivedQty < Number(d.qty);
  if (short && !(body.remark ?? "").trim()) throw new ApiError(400, "Received less than sent: write what is short / कम मिला तो कारण लिखें");
  await prisma.$transaction(async (tx) => {
    await tx.consumableDispatch.update({
      where: { id: d.id },
      data: { receivedQty: body.receivedQty, receivedAt: new Date(), receivedById: user.id, shortReceipt: short, receiptRemark: body.remark || null },
    });
    await adjustStock(tx, d.siteId, d.itemId, body.receivedQty);
    await audit({ userId: user.id, siteId: d.siteId, action: "UPDATE", entity: "ConsumableDispatch", entityId: d.id, oldValues: d, newValues: { receivedQty: body.receivedQty, short }, ip }, tx);
  });
  return ok({ ok: true, short });
});
