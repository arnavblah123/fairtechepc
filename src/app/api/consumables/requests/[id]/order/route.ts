import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { consOrderSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { dateKeyToDate } from "@/lib/format";
import { partyFor } from "@/lib/expenses";

/**
 * Purchase desk (Pune) places the order with a vendor.
 * Only possible after Arnav has approved the request.
 */
export const POST = withAuth<{ id: string }>("consumable.order", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, consOrderSchema);
  const r = await prisma.consumableRequest.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!r) throw new ApiError(404, "Request not found");
  if (r.status !== "APPROVED") throw new ApiError(400, "Only approved requests can be ordered");
  if (r.fulfilment === "LOCAL_PURCHASE") throw new ApiError(400, "This one was approved for local purchase by the site");

  const vendor = await prisma.$transaction((tx) => partyFor(tx, r.siteId, body.vendorName, "VENDOR"));
  const after = await prisma.consumableRequest.update({
    where: { id: r.id },
    data: {
      status: "ORDERED",
      vendorName: body.vendorName,
      vendorPartyId: vendor.id,
      poNumber: body.poNumber || null,
      unitPrice: body.unitPrice ?? null,
      expectedDate: dateKeyToDate(body.expectedDate),
      orderNote: body.orderNote || null,
      orderedAt: new Date(),
      orderedById: user.id,
      qty: body.qty ?? r.qty, // purchase may round up to a sellable pack size
    },
  });
  await audit({ userId: user.id, siteId: r.siteId, action: "UPDATE", entity: "ConsumableRequest", entityId: r.id, oldValues: { status: r.status }, newValues: { status: "ORDERED", vendor: body.vendorName, po: body.poNumber }, ip });
  return ok({ ok: true, status: after.status });
});
