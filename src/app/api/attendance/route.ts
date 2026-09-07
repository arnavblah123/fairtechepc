import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { attendanceMarkSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { assertEditableDate } from "@/lib/dates-guard";
import { dateKeyToDate } from "@/lib/format";
import { dateKey } from "@/lib/validation";

export const GET = withAuth("attendance.mark", async ({ user, req }) => {
  const url = new URL(req.url);
  const siteId = await resolveSiteId(user, url.searchParams.get("siteId"));
  const date = dateKey.parse(url.searchParams.get("date"));
  const [rows, muster, holiday] = await Promise.all([
    prisma.attendance.findMany({ where: { siteId, date: dateKeyToDate(date) } }),
    prisma.sitePhoto.findFirst({ where: { siteId, kind: "MUSTER", date: dateKeyToDate(date), voidedAt: null } }),
    prisma.holiday.findUnique({ where: { siteId_date: { siteId, date: dateKeyToDate(date) } } }),
  ]);
  return ok({ rows, musterUrl: muster?.url ?? null, holiday: holiday?.name ?? null });
});

/** Upsert one worker's attendance for a date. Muster photo must exist first. */
export const POST = withAuth("attendance.mark", async ({ user, req, ip }) => {
  const body = await parseBody(req, attendanceMarkSchema);
  const worker = await prisma.worker.findUnique({ where: { id: body.workerId } });
  if (!worker || !worker.active) throw new ApiError(404, "Worker not found");
  const siteId = await resolveSiteId(user, worker.siteId);
  await assertEditableDate(user, siteId, "ATTENDANCE", body.date);
  const date = dateKeyToDate(body.date);
  const muster = await prisma.sitePhoto.findFirst({ where: { siteId, kind: "MUSTER", date, voidedAt: null } });
  if (!muster) throw new ApiError(400, "Take the muster photo first / पहले मस्टर फोटो लें");
  const before = await prisma.attendance.findUnique({ where: { workerId_date: { workerId: worker.id, date } } });
  const data = {
    status: body.status,
    inTime: body.inTime ?? null,
    outTime: body.outTime ?? null,
    otHours: body.otHours,
    remark: body.remark || null,
    markedById: user.id,
  };
  const after = before
    ? await prisma.attendance.update({ where: { id: before.id }, data })
    : await prisma.attendance.create({ data: { ...data, siteId, workerId: worker.id, date } });
  await audit({ userId: user.id, siteId, action: before ? "UPDATE" : "CREATE", entity: "Attendance", entityId: after.id, oldValues: before ?? undefined, newValues: after, ip });
  return ok({ id: after.id });
});
