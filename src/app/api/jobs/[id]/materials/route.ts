import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { jobMaterialSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertSiteAccess } from "@/lib/site";

export const GET = withAuth<{ id: string }>("job.view", async ({ user, params }) => {
  const job = await prisma.job.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!job) throw new ApiError(404, "Job not found");
  assertSiteAccess(user, job.siteId);
  const materials = await prisma.jobMaterial.findMany({
    where: { jobId: job.id, voidedAt: null },
    orderBy: { item: { name: "asc" } },
    include: { item: { select: { name: true, unit: true } } },
  });
  return ok({ materials });
});

/**
 * Set the consumables planned for this job up front. Adding the same item again
 * updates its planned quantity rather than creating a duplicate line.
 */
export const POST = withAuth<{ id: string }>("material.plan", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, jobMaterialSchema);
  const job = await prisma.job.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!job) throw new ApiError(404, "Job not found");
  assertSiteAccess(user, job.siteId);
  const ids = body.items.map((i) => i.itemId);
  const found = await prisma.consumableItem.count({ where: { id: { in: ids }, active: true } });
  if (found !== new Set(ids).size) throw new ApiError(400, "One of the items no longer exists");

  await prisma.$transaction(async (tx) => {
    for (const i of body.items) {
      await tx.jobMaterial.upsert({
        where: { jobId_itemId: { jobId: job.id, itemId: i.itemId } },
        update: { plannedQty: i.plannedQty, note: i.note || null, voidedAt: null, voidReason: null, addedById: user.id },
        create: { siteId: job.siteId, jobId: job.id, itemId: i.itemId, plannedQty: i.plannedQty, note: i.note || null, addedById: user.id },
      });
    }
    await audit({ userId: user.id, siteId: job.siteId, action: "CREATE", entity: "JobMaterial", entityId: job.id, newValues: body, ip }, tx);
  });
  return ok({ count: body.items.length }, 201);
});
