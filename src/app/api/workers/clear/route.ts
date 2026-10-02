import { z } from "zod";
import { withAuth, parseBody, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";

/**
 * Deactivate every worker at the site in one go. Meant for clearing sample
 * labour before real names go in. Nothing is erased: attendance, wages and
 * ledgers stay, and each worker can be reactivated from their page.
 */
export const POST = withAuth("record.delete", async ({ user, req, ip }) => {
  const { reason } = await parseBody(req, z.object({ reason: z.string().trim().min(3).max(300) }));
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const result = await prisma.worker.updateMany({ where: { siteId, active: true }, data: { active: false, leavingDate: new Date() } });
  await audit({ userId: user.id, siteId, action: "VOID", entity: "Worker", entityId: "all", newValues: { cleared: result.count, reason }, ip });
  return ok({ cleared: result.count });
});
