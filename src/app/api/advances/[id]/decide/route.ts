import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { advanceDecideSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Approved advances auto-deduct from the worker's next wage sheet. */
export const POST = withAuth<{ id: string }>("advance.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, advanceDecideSchema);
  const before = await prisma.advance.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!before) throw new ApiError(404, "Advance not found");
  if (before.status !== "PENDING") throw new ApiError(400, "Already decided");
  const after = await prisma.advance.update({
    where: { id: before.id },
    data: { status: body.decision, decidedById: user.id, decidedAt: new Date(), decisionNote: body.note || null, paidAt: body.decision === "APPROVED" ? new Date() : null },
  });
  await audit({ userId: user.id, siteId: after.siteId, action: body.decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "Advance", entityId: after.id, oldValues: before, newValues: after, ip });
  return ok({ ok: true });
});
