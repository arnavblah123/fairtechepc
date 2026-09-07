import { withAuth, parseBody, ok } from "@/lib/api";
import { consDispatchSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { dateKeyToDate } from "@/lib/format";

export const GET = withAuth("dpr.view", async ({ user, req }) => {
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const dispatches = await prisma.consumableDispatch.findMany({
    where: { siteId, voidedAt: null },
    orderBy: { dispatchDate: "desc" },
    take: 100,
    include: { item: { select: { name: true, unit: true } }, dispatchedBy: { select: { name: true } }, receivedBy: { select: { name: true } } },
  });
  return ok({ dispatches });
});

/** Superadmin records a consignment sent from the factory. Stock increases on site acknowledgement. */
export const POST = withAuth("consumable.dispatch", async ({ user, req, ip }) => {
  const body = await parseBody(req, consDispatchSchema);
  const siteId = await resolveSiteId(user, body.siteId);
  await prisma.consumableItem.findFirstOrThrow({ where: { id: body.itemId, active: true } });
  const d = await prisma.consumableDispatch.create({
    data: { siteId, itemId: body.itemId, qty: body.qty, dispatchDate: dateKeyToDate(body.dispatchDate), photoUrl: body.photoUrl || null, vehicleRef: body.vehicleRef || null, dispatchedById: user.id },
  });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "ConsumableDispatch", entityId: d.id, newValues: d, ip });
  return ok({ id: d.id }, 201);
});
