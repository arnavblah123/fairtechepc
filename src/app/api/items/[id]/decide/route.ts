import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { itemDecideSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Superadmin accepts a site-added item into the master, or rejects it (deactivates). */
export const POST = withAuth<{ id: string }>("item.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, itemDecideSchema);
  const item = await prisma.consumableItem.findUnique({ where: { id: params.id } });
  if (!item) throw new ApiError(404, "Item not found");
  const after = await prisma.consumableItem.update({
    where: { id: item.id },
    data: body.decision === "APPROVED" ? { approved: true } : { approved: false, active: false },
  });
  await audit({ userId: user.id, action: body.decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "ConsumableItem", entityId: item.id, oldValues: { approved: item.approved, active: item.active }, newValues: { approved: after.approved, active: after.active, note: body.note }, ip });
  return ok({ ok: true });
});
