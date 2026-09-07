import { withAuth, parseBody, ok } from "@/lib/api";
import { itemSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const GET = withAuth("dpr.view", async () => {
  const items = await prisma.consumableItem.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return ok({ items });
});

export const POST = withAuth("consumable.approve", async ({ user, req, ip }) => {
  const body = await parseBody(req, itemSchema);
  const item = await prisma.consumableItem.create({ data: { ...body, kgPerUnit: body.kgPerUnit ?? null } });
  await audit({ userId: user.id, action: "CREATE", entity: "ConsumableItem", entityId: item.id, newValues: item, ip });
  return ok({ id: item.id }, 201);
});
