import { z } from "zod";
import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { stageSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

const bodySchema = z.union([stageSchema, z.object({ stages: z.array(stageSchema).min(1).max(30) })]);

/** Superadmin adds one stage or a whole list, appended in order after existing stages. */
export const POST = withAuth<{ id: string }>("stage.manage", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, bodySchema);
  const job = await prisma.job.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!job) throw new ApiError(404, "Job not found");
  const list = "stages" in body ? body.stages : [body];
  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.stage.aggregate({ where: { jobId: job.id }, _max: { sequence: true } });
    let seq = last._max.sequence ?? 0;
    const rows = [];
    for (const s of list) {
      seq += 1;
      const row = await tx.stage.create({ data: { ...s, sequence: seq, jobId: job.id, siteId: job.siteId } });
      await audit({ userId: user.id, siteId: job.siteId, action: "CREATE", entity: "Stage", entityId: row.id, newValues: row, ip }, tx);
      rows.push(row);
    }
    return rows;
  });
  return ok({ ids: created.map((c) => c.id) }, 201);
});
