import { withAuth, parseBody, ok } from "@/lib/api";
import { itemSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const PATCH = withAuth<{ id: string }>("consumable.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, itemSchema.partial());
  const before = await prisma.consumableItem.findUniqueOrThrow({ where: { id: params.id } });
  const after = await prisma.consumableItem.update({ where: { id: before.id }, data: { ...body, kgPerUnit: body.kgPerUnit === undefined ? undefined : body.kgPerUnit } });
  await audit({ userId: user.id, action: "UPDATE", entity: "ConsumableItem", entityId: after.id, oldValues: before, newValues: after, ip });
  return ok({ ok: true });
});
