import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { machineReceiveSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { AuthError } from "@/lib/auth";
import { assertSiteAccess } from "@/lib/site";
import { can } from "@/lib/permissions";

/** Acknowledge a machine's arrival: at site (site roles) or back at factory (superadmin). */
export const POST = withAuth<{ id: string }>(null, async ({ user, req, params, ip }) => {
  const body = await parseBody(req, machineReceiveSchema);
  const d = await prisma.machineDispatch.findFirst({ where: { id: params.id, voidedAt: null }, include: { machine: true } });
  if (!d) throw new ApiError(404, "Dispatch not found");
  if (d.receivedAt) throw new ApiError(400, "Already acknowledged");

  if (d.direction === "TO_SITE") {
    if (!can(user.role, "machine.receive")) throw new AuthError(403, "Not allowed for your role");
    assertSiteAccess(user, d.siteId);
  } else if (user.role !== "SUPERADMIN") {
    throw new AuthError(403, "Only Arnav confirms returns to factory");
  }

  await prisma.$transaction(async (tx) => {
    await tx.machineDispatch.update({
      where: { id: d.id },
      data: { receivedAt: new Date(), conditionOnReceipt: body.condition, receivedPhotoUrl: body.photoUrl || null, receivedById: user.id, remark: body.remark ? `${d.remark ? d.remark + " | " : ""}Receipt: ${body.remark}` : d.remark },
    });
    await tx.machine.update({
      where: { id: d.machineId },
      data: d.direction === "TO_SITE" ? { status: body.condition === "NEEDS_REPAIR" ? "UNDER_REPAIR" : "IDLE" } : { siteId: null, status: "AT_FACTORY" },
    });
    await audit({ userId: user.id, siteId: d.siteId, action: "UPDATE", entity: "MachineDispatch", entityId: d.id, oldValues: d, newValues: { received: true, condition: body.condition }, ip }, tx);
  });
  return ok({ ok: true });
});
