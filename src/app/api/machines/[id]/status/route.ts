import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { machineStatusSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertSiteAccess } from "@/lib/site";

/** Site marks a machine Running / Idle / Under repair. */
export const POST = withAuth<{ id: string }>("machine.ticket", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, machineStatusSchema);
  const m = await prisma.machine.findFirst({ where: { id: params.id, active: true } });
  if (!m || !m.siteId) throw new ApiError(404, "Machine is not at a site");
  assertSiteAccess(user, m.siteId);
  const after = await prisma.machine.update({ where: { id: m.id }, data: { status: body.status } });
  await audit({ userId: user.id, siteId: m.siteId, action: "UPDATE", entity: "Machine", entityId: m.id, oldValues: { status: m.status }, newValues: { status: after.status }, ip });
  return ok({ ok: true });
});
