import { withAuth, parseBody, ok } from "@/lib/api";
import { consRequestSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { dateKeyToDate } from "@/lib/format";

export const GET = withAuth("dpr.view", async ({ user, req }) => {
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const requests = await prisma.consumableRequest.findMany({
    where: { siteId, voidedAt: null },
    orderBy: { requestedAt: "desc" },
    take: 100,
    include: { item: { select: { name: true, unit: true } }, requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } },
  });
  return ok({ requests });
});

/** Nothing can be bought until Arnav approves. */
export const POST = withAuth("consumable.request", async ({ user, req, ip }) => {
  const body = await parseBody(req, consRequestSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  await prisma.consumableItem.findFirstOrThrow({ where: { id: body.itemId, active: true } });
  const r = await prisma.consumableRequest.create({
    data: { siteId, itemId: body.itemId, qty: body.qty, reason: body.reason, neededBy: dateKeyToDate(body.neededBy), requestedById: user.id },
  });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "ConsumableRequest", entityId: r.id, newValues: r, ip });
  return ok({ id: r.id }, 201);
});
