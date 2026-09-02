import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { jobUpdateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertSiteAccess } from "@/lib/site";
import { jobStageSummary } from "@/lib/jobs";
import { dateKeyToDate } from "@/lib/format";

export const GET = withAuth<{ id: string }>("job.view", async ({ user, params }) => {
  const job = await prisma.job.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!job) throw new ApiError(404, "Job not found");
  assertSiteAccess(user, job.siteId);
  const summary = await jobStageSummary(job.id);
  return ok({ job, ...summary });
});

export const PATCH = withAuth<{ id: string }>("job.manage", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, jobUpdateSchema);
  const before = await prisma.job.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!before) throw new ApiError(404, "Job not found");
  const after = await prisma.job.update({
    where: { id: before.id },
    data: {
      name: body.name,
      clientName: body.clientName,
      description: body.description === undefined ? undefined : body.description || null,
      drawingRef: body.drawingRef === undefined ? undefined : body.drawingRef || null,
      plannedTonnage: body.plannedTonnage,
      plannedStart: body.plannedStart ? dateKeyToDate(body.plannedStart) : undefined,
      plannedEnd: body.plannedEnd ? dateKeyToDate(body.plannedEnd) : undefined,
      weldingNormKgPerMT: body.weldingNormKgPerMT === undefined ? undefined : body.weldingNormKgPerMT,
      status: body.status,
    },
  });
  await audit({ userId: user.id, siteId: after.siteId, action: "UPDATE", entity: "Job", entityId: after.id, oldValues: before, newValues: after, ip });
  return ok({ ok: true });
});
