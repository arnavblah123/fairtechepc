import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { advanceRequestSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";

export const POST = withAuth("advance.request", async ({ user, req, ip }) => {
  const body = await parseBody(req, advanceRequestSchema);
  const worker = await prisma.worker.findFirst({ where: { id: body.workerId, active: true } });
  if (!worker) throw new ApiError(404, "Worker not found");
  const siteId = await resolveSiteId(user, worker.siteId);
  const a = await prisma.advance.create({ data: { siteId, workerId: worker.id, amount: body.amount, reason: body.reason, requestedById: user.id } });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "Advance", entityId: a.id, newValues: a, ip });
  return ok({ id: a.id }, 201);
});
