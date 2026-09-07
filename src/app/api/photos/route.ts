import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { sitePhotoSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { istDateKey, istHour, dateKeyToDate } from "@/lib/format";
import { slotForHour } from "@/lib/slots";

/**
 * Record a daily site photo. The date and slot come from the SERVER clock (IST),
 * so a missed window can never be backfilled. Geo accuracy must be <= 100 m
 * (also validated client-side before upload).
 */
export const POST = withAuth("photo.upload", async ({ user, req, ip }) => {
  const body = await parseBody(req, sitePhotoSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  if (body.jobId) {
    const job = await prisma.job.findFirst({ where: { id: body.jobId, siteId, voidedAt: null } });
    if (!job) throw new ApiError(400, "Job not found");
    if (body.stageId) {
      const stage = await prisma.stage.findFirst({ where: { id: body.stageId, jobId: body.jobId, voidedAt: null } });
      if (!stage) throw new ApiError(400, "Stage not found");
    }
  }
  const date = istDateKey();
  const slot = slotForHour(istHour());
  const photo = await prisma.sitePhoto.create({
    data: {
      siteId,
      kind: "DAILY_SLOT",
      date: dateKeyToDate(date),
      slot,
      url: body.url,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracyM: body.accuracyM,
      caption: body.caption || null,
      jobId: body.jobId || null,
      stageId: body.jobId ? body.stageId || null : null,
      takenById: user.id,
    },
  });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "SitePhoto", entityId: photo.id, newValues: { date, slot, url: body.url }, ip });
  return ok({ id: photo.id, slot }, 201);
});
