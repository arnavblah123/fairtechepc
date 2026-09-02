import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { stageSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const PATCH = withAuth<{ id: string }>("stage.manage", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, stageSchema.partial());
  const before = await prisma.stage.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!before) throw new ApiError(404, "Stage not found");
  const after = await prisma.stage.update({ where: { id: before.id }, data: body });
  await audit({ userId: user.id, siteId: after.siteId, action: "UPDATE", entity: "Stage", entityId: after.id, oldValues: before, newValues: after, ip });
  return ok({ ok: true });
});
