import { withAuth, parseBody, ok } from "@/lib/api";
import { siteSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const GET = withAuth("site.manage", async () => {
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });
  return ok({ sites });
});

export const POST = withAuth("site.manage", async ({ user, req, ip }) => {
  const body = await parseBody(req, siteSchema);
  const site = await prisma.site.create({
    data: {
      code: body.code,
      name: body.name,
      city: body.city,
      address: body.address || null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      pettyCashThreshold: body.pettyCashThreshold,
      active: body.active,
    },
  });
  await audit({ userId: user.id, siteId: site.id, action: "CREATE", entity: "Site", entityId: site.id, newValues: site, ip });
  return ok({ id: site.id }, 201);
});
