import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { machineDispatchSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { AuthError } from "@/lib/auth";
import { assertSiteAccess } from "@/lib/site";
import { can } from "@/lib/permissions";
import { dateKeyToDate } from "@/lib/format";

/**
 * TO_SITE: superadmin sends a machine from the factory (site receives it later).
 * TO_FACTORY: site sends it back (factory acknowledges later).
 */
export const POST = withAuth<{ id: string }>(null, async ({ user, req, params, ip }) => {
  const body = await parseBody(req, machineDispatchSchema);
  const m = await prisma.machine.findFirst({ where: { id: params.id, active: true } });
  if (!m) throw new ApiError(404, "Machine not found");
  const open = await prisma.machineDispatch.findFirst({ where: { machineId: m.id, receivedAt: null, voidedAt: null } });
  if (open) throw new ApiError(400, "This machine already has a dispatch awaiting acknowledgement");

  if (body.direction === "TO_SITE") {
    if (!can(user.role, "machine.dispatch")) throw new AuthError(403, "Only Arnav can dispatch machines to site");
    if (m.siteId) throw new ApiError(400, "Machine is already at a site");
  } else {
    if (!can(user.role, "machine.receive")) throw new AuthError(403, "Not allowed for your role");
    if (!m.siteId) throw new ApiError(400, "Machine is not at a site");
    assertSiteAccess(user, m.siteId);
    if (m.siteId !== body.siteId) throw new ApiError(400, "Wrong site");
  }

  const d = await prisma.$transaction(async (tx) => {
    const created = await tx.machineDispatch.create({
      data: {
        machineId: m.id,
        siteId: body.siteId,
        direction: body.direction,
        dispatchDate: dateKeyToDate(body.dispatchDate),
        conditionOnDispatch: body.condition,
        dispatchPhotoUrl: body.photoUrl || null,
        remark: body.remark || null,
        dispatchedById: user.id,
      },
    });
    await tx.machine.update({
      where: { id: m.id },
      data: body.direction === "TO_SITE" ? { siteId: body.siteId, status: "AT_FACTORY" } : { status: "RETURNED_TO_FACTORY" },
    });
    await audit({ userId: user.id, siteId: body.siteId, action: "CREATE", entity: "MachineDispatch", entityId: created.id, newValues: created, ip }, tx);
    return created;
  });
  return ok({ id: d.id }, 201);
});
