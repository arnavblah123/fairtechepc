import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { stageReorderSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Body: { order: [stageId, ...] } covering every non-void stage of the job. */
export const POST = withAuth<{ id: string }>("stage.manage", async ({ user, req, params, ip }) => {
  const { order } = await parseBody(req, stageReorderSchema);
  const job = await prisma.job.findFirst({ where: { id: params.id, voidedAt: null }, include: { stages: { where: { voidedAt: null } } } });
  if (!job) throw new ApiError(404, "Job not found");
  const ids = new Set(job.stages.map((s) => s.id));
  if (order.length !== ids.size || !order.every((id) => ids.has(id))) throw new ApiError(400, "Order must list every stage exactly once");
  await prisma.$transaction(async (tx) => {
    // Two passes to avoid tripping the (jobId, sequence) unique index mid-way.
    for (let i = 0; i < order.length; i++) await tx.stage.update({ where: { id: order[i] }, data: { sequence: 1000 + i } });
    for (let i = 0; i < order.length; i++) await tx.stage.update({ where: { id: order[i] }, data: { sequence: i + 1 } });
    // Voided stages keep out of the way at the end.
    const voided = await tx.stage.findMany({ where: { jobId: job.id, voidedAt: { not: null } }, orderBy: { sequence: "asc" } });
    for (let i = 0; i < voided.length; i++) await tx.stage.update({ where: { id: voided[i].id }, data: { sequence: order.length + 1 + i } });
    await audit({ userId: user.id, siteId: job.siteId, action: "UPDATE", entity: "Stage", entityId: job.id, oldValues: { order: job.stages.sort((a, b) => a.sequence - b.sequence).map((s) => s.id) }, newValues: { order }, ip }, tx);
  });
  return ok({ ok: true });
});
