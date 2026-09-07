import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { consumeSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { assertEditableDate } from "@/lib/dates-guard";
import { adjustStock } from "@/lib/consumables";
import { dateKeyToDate } from "@/lib/format";

/** Daily consumption against a job. Stock reduces automatically. */
export const POST = withAuth("consumable.consume", async ({ user, req, ip }) => {
  const body = await parseBody(req, consumeSchema);
  const job = await prisma.job.findFirst({ where: { id: body.jobId, voidedAt: null } });
  if (!job) throw new ApiError(404, "Job not found");
  const siteId = await resolveSiteId(user, job.siteId);
  await assertEditableDate(user, siteId, "CONSUMPTION", body.date);
  if (body.stageId) {
    const stage = await prisma.stage.findFirst({ where: { id: body.stageId, jobId: job.id, voidedAt: null } });
    if (!stage) throw new ApiError(400, "Stage not found");
  }
  const row = await prisma.$transaction(async (tx) => {
    await adjustStock(tx, siteId, body.itemId, -body.qty);
    const created = await tx.consumableConsumption.create({
      data: { siteId, itemId: body.itemId, jobId: job.id, stageId: body.stageId || null, date: dateKeyToDate(body.date), qty: body.qty, remark: body.remark || null, enteredById: user.id },
    });
    await audit({ userId: user.id, siteId, action: "CREATE", entity: "ConsumableConsumption", entityId: created.id, newValues: created, ip }, tx);
    return created;
  });
  return ok({ id: row.id }, 201);
});
