import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { stageBulkSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Add the whole stage list in one save, in the order given. */
export const POST = withAuth<{ id: string }>("stage.manage", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, stageBulkSchema);
  const job = await prisma.job.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!job) throw new ApiError(404, "Job not found");
  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.stage.aggregate({ where: { jobId: job.id }, _max: { sequence: true } });
    let seq = last._max.sequence ?? 0;
    const rows = [];
    for (const s of body.stages) {
      seq += 1;
      rows.push(await tx.stage.create({ data: { ...s, sequence: seq, jobId: job.id, siteId: job.siteId } }));
    }
    await audit({ userId: user.id, siteId: job.siteId, action: "CREATE", entity: "Stage", entityId: job.id, newValues: { added: body.stages.length }, ip }, tx);
    return rows;
  });
  return ok({ ids: created.map((c) => c.id) }, 201);
});
