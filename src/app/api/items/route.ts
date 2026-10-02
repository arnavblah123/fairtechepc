import { withAuth, parseBody, ok } from "@/lib/api";
import { itemSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const GET = withAuth("consumable.view", async () => {
  const items = await prisma.consumableItem.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return ok({ items });
});

export const POST = withAuth("item.manage", async ({ user, req, ip }) => {
  const body = await parseBody(req, itemSchema);
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.consumableItem.create({ data: { ...body, kgPerUnit: body.kgPerUnit ?? null } });
    const sites = await tx.site.findMany({ where: { active: true }, select: { id: true } });
    await tx.consumableStock.createMany({ data: sites.map((st) => ({ siteId: st.id, itemId: created.id, qtyOnHand: 0 })), skipDuplicates: true });
    await audit({ userId: user.id, action: "CREATE", entity: "ConsumableItem", entityId: created.id, newValues: created, ip }, tx);
    return created;
  });
  return ok({ id: item.id, name: item.name, unit: item.unit }, 201);
});
