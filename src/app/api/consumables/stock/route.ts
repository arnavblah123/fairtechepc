import { z } from "zod";
import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";

const schema = z.object({
  itemId: z.string().min(1),
  qtyOnHand: z.coerce.number().min(0).max(999999999),
  reason: z.string().trim().min(3, "Give a reason").max(300),
});

/**
 * Superadmin sets stock on hand directly — after a physical count, an opening
 * balance, or to fix a wrong entry. The old and new figures go to the audit log.
 */
export const POST = withAuth("stock.adjust", async ({ user, req, ip }) => {
  const body = await parseBody(req, schema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const item = await prisma.consumableItem.findFirst({ where: { id: body.itemId, active: true } });
  if (!item) throw new ApiError(404, "Item not found");
  const before = await prisma.consumableStock.upsert({
    where: { siteId_itemId: { siteId, itemId: item.id } },
    update: {},
    create: { siteId, itemId: item.id, qtyOnHand: 0 },
  });
  const after = await prisma.consumableStock.update({ where: { id: before.id }, data: { qtyOnHand: body.qtyOnHand } });
  await audit({
    userId: user.id,
    siteId,
    action: "UPDATE",
    entity: "ConsumableStock",
    entityId: after.id,
    oldValues: { item: item.name, qtyOnHand: Number(before.qtyOnHand) },
    newValues: { item: item.name, qtyOnHand: body.qtyOnHand, reason: body.reason },
    ip,
  });
  return ok({ qtyOnHand: Number(after.qtyOnHand), change: body.qtyOnHand - Number(before.qtyOnHand) });
});
