import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { dailyPlanSchema, dateKey } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { dateKeyToDate, istDateKey } from "@/lib/format";

export const GET = withAuth("dpr.view", async ({ user, req }) => {
  const url = new URL(req.url);
  const siteId = await resolveSiteId(user, url.searchParams.get("siteId"));
  const date = dateKey.parse(url.searchParams.get("date"));
  const plan = await prisma.dailyPlan.findUnique({
    where: { siteId_date: { siteId, date: dateKeyToDate(date) } },
    include: { items: { include: { job: { select: { jobNumber: true, name: true } }, stage: { select: { name: true, unit: true } } } }, submittedBy: { select: { name: true } } },
  });
  return ok({ plan });
});

/** Submit/replace today's plan. Editable the whole day it is for. */
export const POST = withAuth("plan.submit", async ({ user, req, ip }) => {
  const body = await parseBody(req, dailyPlanSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  if (body.date !== istDateKey()) throw new ApiError(400, "The daily plan is for today only / दैनिक योजना सिर्फ़ आज के लिए");
  const stages = await prisma.stage.findMany({ where: { id: { in: body.items.map((i) => i.stageId) }, siteId, voidedAt: null }, select: { id: true, jobId: true } });
  const stageMap = new Map(stages.map((s) => [s.id, s.jobId]));
  for (const item of body.items) {
    if (stageMap.get(item.stageId) !== item.jobId) throw new ApiError(400, "Stage does not belong to that job");
  }
  const date = dateKeyToDate(body.date);
  const plan = await prisma.$transaction(async (tx) => {
    const before = await tx.dailyPlan.findUnique({ where: { siteId_date: { siteId, date } }, include: { items: true } });
    if (before) await tx.dailyPlanItem.deleteMany({ where: { planId: before.id } });
    const saved = before
      ? await tx.dailyPlan.update({ where: { id: before.id }, data: { remark: body.remark || null, submittedById: user.id, items: { create: body.items.map(clean) } } })
      : await tx.dailyPlan.create({ data: { siteId, date, remark: body.remark || null, submittedById: user.id, items: { create: body.items.map(clean) } } });
    await audit({ userId: user.id, siteId, action: before ? "UPDATE" : "SUBMIT", entity: "DailyPlan", entityId: saved.id, oldValues: before ?? undefined, newValues: body, ip }, tx);
    return saved;
  });
  return ok({ id: plan.id }, 201);
});

function clean(i: { jobId: string; stageId: string; targetQty: number; manpowerPlanned: number; note?: string }) {
  return { jobId: i.jobId, stageId: i.stageId, targetQty: i.targetQty, manpowerPlanned: i.manpowerPlanned, note: i.note || null };
}
