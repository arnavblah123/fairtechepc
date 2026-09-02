import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { updateUserSchema } from "@/lib/validation";
import { revokeUserSessions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const GET = withAuth<{ id: string }>("user.manage", async ({ params }) => {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: params.id },
    select: { id: true, username: true, name: true, phone: true, role: true, siteId: true, active: true, lastLoginAt: true, createdAt: true },
  });
  return ok(u);
});

export const PATCH = withAuth<{ id: string }>("user.manage", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, updateUserSchema);
  const before = await prisma.user.findUniqueOrThrow({ where: { id: params.id } });
  if (before.id === user.id && (!body.active || body.role !== "SUPERADMIN")) {
    throw new ApiError(400, "You cannot deactivate or demote your own account");
  }
  if (before.role === "SUPERADMIN" && (body.role !== "SUPERADMIN" || !body.active)) {
    const others = await prisma.user.count({ where: { role: "SUPERADMIN", active: true, id: { not: before.id } } });
    if (others === 0) throw new ApiError(400, "At least one active superadmin must remain");
  }
  const after = await prisma.user.update({
    where: { id: params.id },
    data: {
      name: body.name,
      phone: body.phone || null,
      role: body.role,
      siteId: body.role === "SUPERADMIN" ? null : body.siteId,
      active: body.active,
    },
  });
  if (!after.active || after.role !== before.role || after.siteId !== before.siteId) await revokeUserSessions(after.id);
  await audit({ userId: user.id, siteId: after.siteId, action: "UPDATE", entity: "User", entityId: after.id, oldValues: before, newValues: after, ip });
  return ok({ ok: true });
});
