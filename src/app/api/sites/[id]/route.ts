import { withAuth, parseBody, ok } from "@/lib/api";
import { siteSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const PATCH = withAuth<{ id: string }>("site.manage", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, siteSchema.omit({ code: true }));
  const before = await prisma.site.findUniqueOrThrow({ where: { id: params.id } });
  const after = await prisma.site.update({
    where: { id: params.id },
    data: {
      name: body.name,
      city: body.city,
      address: body.address || null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      pettyCashThreshold: body.pettyCashThreshold,
      active: body.active,
    },
  });
  await audit({ userId: user.id, siteId: after.id, action: "UPDATE", entity: "Site", entityId: after.id, oldValues: before, newValues: after, ip });
  return ok({ ok: true });
});
