import { withAuth, parseBody, ok } from "@/lib/api";
import { itemProposeSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { normalizePartyName } from "@/lib/parties";

/**
 * A site user adds an item that is not in the master while raising a request.
 * It is usable immediately so the order is not held up, but it carries
 * approved=false and is flagged for the superadmin. A near-identical name that
 * already exists is returned instead of creating a duplicate.
 */
export const POST = withAuth("item.propose", async ({ user, req, ip }) => {
  const body = await parseBody(req, itemProposeSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const wanted = normalizePartyName(body.name);
  const all = await prisma.consumableItem.findMany({ where: { active: true }, select: { id: true, name: true, unit: true, approved: true } });
  const existing = all.find((i) => normalizePartyName(i.name) === wanted);
  if (existing) return ok({ id: existing.id, name: existing.name, unit: existing.unit, existed: true });

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.consumableItem.create({
      data: { name: body.name, unit: body.unit, category: body.category, approved: false, proposedById: user.id },
    });
    await tx.consumableStock.create({ data: { siteId, itemId: created.id, qtyOnHand: 0 } });
    await audit({ userId: user.id, siteId, action: "CREATE", entity: "ConsumableItem", entityId: created.id, newValues: { ...created, proposed: true }, ip }, tx);
    return created;
  });
  return ok({ id: item.id, name: item.name, unit: item.unit, existed: false }, 201);
});
