import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { ticketSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertSiteAccess } from "@/lib/site";
import { dateKeyToDate } from "@/lib/format";

/** Breakdown ticket, raised on site. Machine goes to Under repair. */
export const POST = withAuth<{ id: string }>("machine.ticket", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, ticketSchema);
  const m = await prisma.machine.findFirst({ where: { id: params.id, active: true } });
  if (!m || !m.siteId) throw new ApiError(404, "Machine is not at a site");
  assertSiteAccess(user, m.siteId);
  const open = await prisma.machineTicket.findFirst({ where: { machineId: m.id, status: { not: "RESOLVED" }, voidedAt: null } });
  if (open) throw new ApiError(400, "This machine already has an open ticket");
  const t = await prisma.$transaction(async (tx) => {
    const created = await tx.machineTicket.create({
      data: { machineId: m.id, siteId: m.siteId!, problem: body.problem, raisedOn: dateKeyToDate(body.raisedOn), raisedById: user.id },
    });
    await tx.machine.update({ where: { id: m.id }, data: { status: "UNDER_REPAIR" } });
    await audit({ userId: user.id, siteId: m.siteId, action: "CREATE", entity: "MachineTicket", entityId: created.id, newValues: created, ip }, tx);
    return created;
  });
  return ok({ id: t.id }, 201);
});
