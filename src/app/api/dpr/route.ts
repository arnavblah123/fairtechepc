import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { dprSubmitSchema, dateKey } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { compileDpr } from "@/lib/dpr";
import { dateKeyToDate, istDateKey } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const GET = withAuth("dpr.view", async ({ user, req }) => {
  const url = new URL(req.url);
  const siteId = await resolveSiteId(user, url.searchParams.get("siteId"));
  const date = dateKey.parse(url.searchParams.get("date"));
  const dpr = await prisma.dPR.findUnique({ where: { siteId_date: { siteId, date: dateKeyToDate(date) } }, include: { submittedBy: { select: { name: true } } } });
  if (dpr?.status === "SUBMITTED" && dpr.snapshot) {
    return ok({ status: "SUBMITTED", remark: dpr.remark, submittedBy: dpr.submittedBy?.name, submittedAt: dpr.submittedAt, data: dpr.snapshot });
  }
  const data = await compileDpr(siteId, date);
  return ok({ status: "DRAFT", remark: null, data });
});

/** In-charge submits the day's DPR; the compiled report is frozen as a snapshot. */
export const POST = withAuth("dpr.submit", async ({ user, req, ip }) => {
  const body = await parseBody(req, dprSubmitSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  if (body.date > istDateKey()) throw new ApiError(400, "Cannot submit a DPR for a future date");
  const data = await compileDpr(siteId, body.date);
  const date = dateKeyToDate(body.date);
  const existing = await prisma.dPR.findUnique({ where: { siteId_date: { siteId, date } } });
  const saved = existing
    ? await prisma.dPR.update({
        where: { id: existing.id },
        data: { status: "SUBMITTED", snapshot: data as unknown as Prisma.InputJsonValue, remark: body.remark || null, submittedById: user.id, submittedAt: new Date() },
      })
    : await prisma.dPR.create({
        data: { siteId, date, status: "SUBMITTED", snapshot: data as unknown as Prisma.InputJsonValue, remark: body.remark || null, submittedById: user.id, submittedAt: new Date() },
      });
  await audit({ userId: user.id, siteId, action: "SUBMIT", entity: "DPR", entityId: saved.id, newValues: { date: body.date, remark: body.remark }, ip });
  return ok({ id: saved.id }, 201);
});
