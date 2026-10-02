import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { indentDecideSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Decide every still-pending line of an indent at once. Lines already decided are left alone. */
export const POST = withAuth<{ id: string }>("consumable.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, indentDecideSchema);
  const indent = await prisma.materialIndent.findFirst({ where: { id: params.id, voidedAt: null }, include: { lines: { where: { status: "PENDING", voidedAt: null }, select: { id: true, itemId: true } } } });
  if (!indent) throw new ApiError(404, "Indent not found");
  if (indent.lines.length === 0) throw new ApiError(400, "Nothing left to decide on this indent");
  await prisma.$transaction(async (tx) => {
    if (body.decision === "APPROVED") {
      await tx.consumableItem.updateMany({ where: { id: { in: indent.lines.map((l) => l.itemId) }, approved: false }, data: { approved: true } });
    }
    await tx.consumableRequest.updateMany({
      where: { id: { in: indent.lines.map((l) => l.id) } },
      data: { status: body.decision, fulfilment: body.decision === "APPROVED" ? body.fulfilment : null, decidedById: user.id, decidedAt: new Date(), decisionNote: body.note || null },
    });
    await audit({ userId: user.id, siteId: indent.siteId, action: body.decision === "APPROVED" ? "APPROVE" : "REJECT", entity: "MaterialIndent", entityId: indent.id, newValues: { status: body.decision, fulfilment: body.fulfilment, lines: indent.lines.length }, ip }, tx);
  });
  return ok({ decided: indent.lines.length });
});
