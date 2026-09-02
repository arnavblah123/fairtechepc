import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { voidSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Soft delete. The job number is never reused. */
export const POST = withAuth<{ id: string }>("job.manage", async ({ user, req, params, ip }) => {
  const { reason } = await parseBody(req, voidSchema);
  const before = await prisma.job.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!before) throw new ApiError(404, "Job not found");
  const after = await prisma.job.update({ where: { id: before.id }, data: { voidedAt: new Date(), voidReason: reason, status: "CLOSED" } });
  await audit({ userId: user.id, siteId: after.siteId, action: "VOID", entity: "Job", entityId: after.id, oldValues: before, newValues: { voidReason: reason }, ip });
  return ok({ ok: true });
});
