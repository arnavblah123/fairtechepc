import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { consShipSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { dateKeyToDate } from "@/lib/format";

/**
 * Send ordered material towards the site. This creates the inward record the
 * site then acknowledges (quantity + short-receipt check) on arrival.
 */
export const POST = withAuth<{ id: string }>("consumable.dispatch", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, consShipSchema);
  const r = await prisma.consumableRequest.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!r) throw new ApiError(404, "Request not found");
  if (r.status !== "ORDERED" && r.status !== "APPROVED") throw new ApiError(400, "Order it first");
  const d = await prisma.consumableDispatch.create({
    data: {
      siteId: r.siteId,
      itemId: r.itemId,
      requestId: r.id,
      qty: body.qty,
      dispatchDate: dateKeyToDate(body.dispatchDate),
      photoUrl: body.photoUrl || null,
      vehicleRef: body.vehicleRef || null,
      dispatchedById: user.id,
    },
  });
  await audit({ userId: user.id, siteId: r.siteId, action: "CREATE", entity: "ConsumableDispatch", entityId: d.id, newValues: { requestId: r.id, qty: body.qty }, ip });
  return ok({ id: d.id }, 201);
});
