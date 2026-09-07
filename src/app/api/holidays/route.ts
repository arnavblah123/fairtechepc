import { withAuth, parseBody, ok } from "@/lib/api";
import { holidaySchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { dateKeyToDate } from "@/lib/format";

export const POST = withAuth("holiday.manage", async ({ user, req, ip }) => {
  const body = await parseBody(req, holidaySchema);
  const siteId = await resolveSiteId(user, body.siteId);
  const holiday = await prisma.holiday.create({ data: { siteId, date: dateKeyToDate(body.date), name: body.name } });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "Holiday", entityId: holiday.id, newValues: holiday, ip });
  return ok({ id: holiday.id }, 201);
});
