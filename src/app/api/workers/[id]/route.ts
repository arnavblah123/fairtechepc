import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { workerSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertSiteAccess } from "@/lib/site";
import { dateKeyToDate } from "@/lib/format";

export const PATCH = withAuth<{ id: string }>("worker.manage", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, workerSchema.partial());
  const before = await prisma.worker.findUnique({ where: { id: params.id } });
  if (!before) throw new ApiError(404, "Worker not found");
  assertSiteAccess(user, before.siteId);
  const after = await prisma.worker.update({
    where: { id: before.id },
    data: {
      name: body.name,
      phone: body.phone === undefined ? undefined : body.phone || null,
      trade: body.trade,
      joiningDate: body.joiningDate ? dateKeyToDate(body.joiningDate) : undefined,
      wageType: body.wageType,
      contractorName: body.contractorName === undefined ? undefined : body.contractorName || null,
      idDocRef: body.idDocRef === undefined ? undefined : body.idDocRef || null,
      photoUrl: body.photoUrl === undefined ? undefined : body.photoUrl || null,
      active: body.active,
      leavingDate: body.active === false ? new Date() : body.active === true ? null : undefined,
    },
  });
  await audit({ userId: user.id, siteId: after.siteId, action: "UPDATE", entity: "Worker", entityId: after.id, oldValues: before, newValues: after, ip });
  return ok({ ok: true });
});
