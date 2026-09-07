import { withAuth, parseBody, ok } from "@/lib/api";
import { pettyRequestSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";

export const POST = withAuth("petty.request", async ({ user, req, ip }) => {
  const body = await parseBody(req, pettyRequestSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const r = await prisma.pettyCashRequest.create({ data: { siteId, amount: body.amount, reason: body.reason, urgency: body.urgency, requestedById: user.id } });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "PettyCashRequest", entityId: r.id, newValues: r, ip });
  return ok({ id: r.id }, 201);
});
