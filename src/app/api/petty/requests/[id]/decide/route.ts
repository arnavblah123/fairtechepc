import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { pettyDecideSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const POST = withAuth<{ id: string }>("petty.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, pettyDecideSchema);
  const before = await prisma.pettyCashRequest.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!before) throw new ApiError(404, "Request not found");
  if (before.status !== "PENDING") throw new ApiError(400, "Already decided");
  const after = await prisma.pettyCashRequest.update({
    where: { id: before.id },
    data: { status: body.decision, decidedById: user.id, decidedAt: new Date(), decisionNote: body.note || null },
  });
  await audit({ userId: user.id, siteId: after.siteId, action: body.decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "PettyCashRequest", entityId: after.id, oldValues: before, newValues: after, ip });
  return ok({ ok: true });
});
