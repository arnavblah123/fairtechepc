import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validation";
import { hashPassword, verifyPassword, revokeUserSessions, createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Any logged-in user changes their own password. All other sessions are logged out. */
export const POST = withAuth(null, async ({ user, req, ip }) => {
  const body = await parseBody(req, changePasswordSchema);
  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(body.currentPassword, dbUser.passwordHash))) throw new ApiError(400, "Current password is wrong");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
  await revokeUserSessions(user.id);
  await createSession(user.id);
  await audit({ userId: user.id, siteId: user.siteId, action: "PASSWORD_CHANGE", entity: "User", entityId: user.id, ip });
  return ok({ ok: true });
});
