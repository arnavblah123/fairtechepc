import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { consDecideSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Superadmin approves (choosing factory or local purchase) or rejects. */
export const POST = withAuth<{ id: string }>("consumable.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, consDecideSchema);
  const before = await prisma.consumableRequest.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!before) throw new ApiError(404, "Request not found");
  if (before.status !== "PENDING") throw new ApiError(400, "Already decided");
  const after = await prisma.consumableRequest.update({
    where: { id: before.id },
    data: { status: body.decision, fulfilment: body.decision === "APPROVED" ? body.fulfilment : null, decidedById: user.id, decidedAt: new Date(), decisionNote: body.note || null },
  });
  await audit({ userId: user.id, siteId: after.siteId, action: body.decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "ConsumableRequest", entityId: after.id, oldValues: before, newValues: after, ip });
  return ok({ ok: true });
});
