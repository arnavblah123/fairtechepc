import { withAuth, ok, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertWageSheet } from "@/lib/wages";

/** DRAFT → FINAL → PAID. Paid sheets are immutable. */
export const POST = withAuth<{ id: string }>("wage.view", async ({ user, params, ip }) => {
  const s = await assertWageSheet(params.id);
  if (s.status === "PAID") throw new ApiError(400, "Already paid");
  const next = s.status === "DRAFT" ? "FINAL" : "PAID";
  const after = await prisma.wageSheet.update({ where: { id: s.id }, data: { status: next, paidAt: next === "PAID" ? new Date() : null } });
  await audit({ userId: user.id, siteId: s.siteId, action: "UPDATE", entity: "WageSheet", entityId: s.id, oldValues: { status: s.status }, newValues: { status: after.status }, ip });
  return ok({ status: after.status });
});
