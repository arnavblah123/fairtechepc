import { withAuth, ok, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Removing a holiday is a calendar-config change; the removal itself is audited. */
export const DELETE = withAuth<{ id: string }>("holiday.manage", async ({ user, params, ip }) => {
  const before = await prisma.holiday.findUnique({ where: { id: params.id } });
  if (!before) throw new ApiError(404, "Holiday not found");
  await prisma.holiday.delete({ where: { id: before.id } });
  await audit({ userId: user.id, siteId: before.siteId, action: "VOID", entity: "Holiday", entityId: before.id, oldValues: before, ip });
  return ok({ ok: true });
});
