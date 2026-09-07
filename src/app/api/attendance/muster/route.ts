import { withAuth, parseBody, ok } from "@/lib/api";
import { musterSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { assertEditableDate } from "@/lib/dates-guard";
import { dateKeyToDate } from "@/lib/format";

/** Daily geotagged group muster photo, required before attendance can be marked. */
export const POST = withAuth("attendance.mark", async ({ user, req, ip }) => {
  const body = await parseBody(req, musterSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  await assertEditableDate(user, siteId, "ATTENDANCE", body.date);
  const photo = await prisma.sitePhoto.create({
    data: { siteId, kind: "MUSTER", date: dateKeyToDate(body.date), url: body.url, latitude: body.latitude, longitude: body.longitude, accuracyM: body.accuracyM, takenById: user.id },
  });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "SitePhoto", entityId: photo.id, newValues: { kind: "MUSTER", date: body.date, url: body.url }, ip });
  return ok({ id: photo.id, url: photo.url }, 201);
});
