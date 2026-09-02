import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { createUserSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const GET = withAuth("user.manage", async () => {
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    select: { id: true, username: true, name: true, phone: true, role: true, active: true, lastLoginAt: true, site: { select: { name: true } } },
  });
  return ok({ users });
});

export const POST = withAuth("user.manage", async ({ user, req, ip }) => {
  const body = await parseBody(req, createUserSchema);
  if (body.siteId) await prisma.site.findUniqueOrThrow({ where: { id: body.siteId } }).catch(() => { throw new ApiError(400, "Site not found"); });
  const created = await prisma.user.create({
    data: {
      username: body.username,
      passwordHash: await hashPassword(body.password),
      name: body.name,
      phone: body.phone || null,
      role: body.role,
      siteId: body.role === "SUPERADMIN" ? null : body.siteId,
    },
  });
  await audit({ userId: user.id, siteId: created.siteId, action: "CREATE", entity: "User", entityId: created.id, newValues: created, ip });
  return ok({ id: created.id }, 201);
});
