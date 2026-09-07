import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { progressSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { assertEditableDate } from "@/lib/dates-guard";
import { dateKeyToDate } from "@/lib/format";

/** Upsert one stage's progress for a date, with the workers who worked on it. */
export const POST = withAuth("stage.progress", async ({ user, req, ip }) => {
  const body = await parseBody(req, progressSchema);
  const stage = await prisma.stage.findFirst({ where: { id: body.stageId, voidedAt: null }, include: { job: { select: { id: true, status: true } } } });
  if (!stage) throw new ApiError(404, "Stage not found");
  const siteId = await resolveSiteId(user, stage.siteId);
  if (stage.job.status !== "ACTIVE") throw new ApiError(400, "This job is not active");
  await assertEditableDate(user, siteId, "STAGE_PROGRESS", body.date);
  const date = dateKeyToDate(body.date);

  // One stage per worker per day per shift: find conflicts on other stages first and warn with names.
  const ids = body.workers.map((w) => w.workerId);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) throw new ApiError(400, "A worker is listed twice");
  if (ids.length) {
    const conflicts = await prisma.stageWorkLog.findMany({
      where: {
        workerId: { in: ids },
        date,
        shift: { in: body.workers.map((w) => w.shift) },
        stageProgress: { stageId: { not: stage.id } },
      },
      include: { worker: { select: { name: true, code: true } }, stageProgress: { include: { stage: { select: { name: true } } } } },
    });
    const real = conflicts.filter((c) => body.workers.some((w) => w.workerId === c.workerId && w.shift === c.shift));
    if (real.length) {
      const list = real.map((c) => `${c.worker.name} (${c.stageProgress.stage.name})`).join(", ");
      throw new ApiError(409, `Already on another stage today: ${list}. Remove them there first. / यह मज़दूर आज दूसरी स्टेज पर हैं`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.stageProgress.findUnique({ where: { stageId_date: { stageId: stage.id, date } }, include: { workLogs: true } });
    const data = { qtyDone: body.qtyDone, percentComplete: body.percentComplete, remark: body.remark || null, enteredById: user.id };
    const row = before
      ? await tx.stageProgress.update({ where: { id: before.id }, data })
      : await tx.stageProgress.create({ data: { ...data, siteId, jobId: stage.job.id, stageId: stage.id, date } });
    await tx.stageWorkLog.deleteMany({ where: { stageProgressId: row.id } });
    if (body.workers.length) {
      await tx.stageWorkLog.createMany({ data: body.workers.map((w) => ({ stageProgressId: row.id, workerId: w.workerId, date, shift: w.shift, hours: w.hours })) });
    }
    // Maintain the stage's actual start / end dates.
    const patch: { actualStart?: Date; actualEnd?: Date | null } = {};
    if (!stage.actualStart || date < stage.actualStart) patch.actualStart = date;
    if (body.percentComplete >= 100) patch.actualEnd = stage.actualEnd ?? date;
    else if (stage.actualEnd) patch.actualEnd = null;
    if (Object.keys(patch).length) await tx.stage.update({ where: { id: stage.id }, data: patch });
    await audit({ userId: user.id, siteId, action: before ? "UPDATE" : "CREATE", entity: "StageProgress", entityId: row.id, oldValues: before ?? undefined, newValues: body, ip }, tx);
    return row;
  });
  return ok({ id: result.id }, 201);
});
