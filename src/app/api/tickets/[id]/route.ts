import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { ticketUpdateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertSiteAccess } from "@/lib/site";

/**
 * Update repair details; resolving requires a sign-off note from the person who
 * verified the repair (recorded as verifiedBy), so responsibility is fixed.
 */
export const PATCH = withAuth<{ id: string }>("machine.ticket", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, ticketUpdateSchema);
  const t = await prisma.machineTicket.findFirst({ where: { id: params.id, voidedAt: null }, include: { machine: true } });
  if (!t) throw new ApiError(404, "Ticket not found");
  assertSiteAccess(user, t.siteId);
  if (t.status === "RESOLVED") throw new ApiError(400, "Ticket already resolved");
  if (body.resolve && !(body.verificationNote ?? "").trim()) throw new ApiError(400, "Sign-off note is required: who checked the repair and how");

  await prisma.$transaction(async (tx) => {
    if (body.parts) {
      await tx.machineTicketPart.deleteMany({ where: { ticketId: t.id } });
      if (body.parts.length) await tx.machineTicketPart.createMany({ data: body.parts.map((p) => ({ ticketId: t.id, item: p.item, qty: p.qty, price: p.price })) });
    }
    const after = await tx.machineTicket.update({
      where: { id: t.id },
      data: {
        repairType: body.repairType === undefined ? undefined : body.repairType,
        repairedBy: body.repairedBy === undefined ? undefined : body.repairedBy || null,
        repairCost: body.repairCost === undefined ? undefined : body.repairCost,
        downtimeDays: body.downtimeDays === undefined ? undefined : body.downtimeDays,
        status: body.resolve ? "RESOLVED" : body.repairType ? "IN_REPAIR" : undefined,
        resolvedAt: body.resolve ? new Date() : undefined,
        verifiedById: body.resolve ? user.id : undefined,
        verifiedAt: body.resolve ? new Date() : undefined,
        verificationNote: body.resolve ? body.verificationNote : undefined,
      },
    });
    if (body.resolve) {
      await tx.machine.update({ where: { id: t.machineId }, data: { status: "IDLE" } });
    } else if (body.repairType === "SENT_OUT") {
      await tx.machine.update({ where: { id: t.machineId }, data: { status: "SENT_OUT_FOR_REPAIR" } });
    }
    await audit({ userId: user.id, siteId: t.siteId, action: body.resolve ? "APPROVE" : "UPDATE", entity: "MachineTicket", entityId: t.id, oldValues: t, newValues: body, ip }, tx);
  });
  return ok({ ok: true });
});
