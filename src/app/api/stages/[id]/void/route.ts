import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { voidSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const POST = withAuth<{ id: string }>("stage.manage", async ({ user, req, params, ip }) => {
  const { reason } = await parseBody(req, voidSchema);
  const before = await prisma.stage.findFirst({ where: { id: params.id, voidedAt: null }, include: { _count: { select: { progress: true } } } });
  if (!before) throw new ApiError(404, "Stage not found");
  if (before._count.progress > 0) throw new ApiError(400, "This stage already has progress entries and cannot be removed");
  await prisma.$transaction(async (tx) => {
    // Move it to the end so live stages keep a clean 1..n order.
    const max = await tx.stage.aggregate({ where: { jobId: before.jobId }, _max: { sequence: true } });
    await tx.stage.update({ where: { id: before.id }, data: { voidedAt: new Date(), voidReason: reason, sequence: (max._max.sequence ?? 0) + 1 } });
    const live = await tx.stage.findMany({ where: { jobId: before.jobId, voidedAt: null }, orderBy: { sequence: "asc" } });
    for (let i = 0; i < live.length; i++) if (live[i].sequence !== i + 1) await tx.stage.update({ where: { id: live[i].id }, data: { sequence: 1000 + i } });
    for (let i = 0; i < live.length; i++) if (live[i].sequence !== i + 1) await tx.stage.update({ where: { id: live[i].id }, data: { sequence: i + 1 } });
    await audit({ userId: user.id, siteId: before.siteId, action: "VOID", entity: "Stage", entityId: before.id, oldValues: before, newValues: { voidReason: reason }, ip }, tx);
  });
  return ok({ ok: true });
});
