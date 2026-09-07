import { z } from "zod";
import { withAuth, parseBody, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { dateKey } from "@/lib/validation";
import { dateKeyToDate } from "@/lib/format";

const schema = z.object({
  siteId: z.string().min(1),
  module: z.enum(["ATTENDANCE", "CONSUMPTION", "PHOTOS", "EXPENSES", "STAGE_PROGRESS"]),
  date: dateKey,
  reason: z.string().trim().min(3).max(300),
});

export const GET = withAuth("backdate.unlock", async () => {
  const unlocks = await prisma.backdateUnlock.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    include: { site: { select: { code: true } }, unlockedBy: { select: { name: true } } },
  });
  return ok({ unlocks });
});

/** Unlock is valid for 24 hours and is logged. */
export const POST = withAuth("backdate.unlock", async ({ user, req, ip }) => {
  const body = await parseBody(req, schema);
  const siteId = await resolveSiteId(user, body.siteId);
  const unlock = await prisma.backdateUnlock.create({
    data: { siteId, module: body.module, date: dateKeyToDate(body.date), reason: body.reason, unlockedById: user.id, expiresAt: new Date(Date.now() + 24 * 3600 * 1000) },
  });
  await audit({ userId: user.id, siteId, action: "UNLOCK", entity: "BackdateUnlock", entityId: unlock.id, newValues: unlock, ip });
  return ok({ id: unlock.id }, 201);
});
