import { withAuth, parseBody, ok } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation";
import { hashPassword, revokeUserSessions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Superadmin sets a new password for any user; that user is logged out everywhere. */
export const POST = withAuth<{ id: string }>("user.manage", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, resetPasswordSchema);
  const target = await prisma.user.update({ where: { id: params.id }, data: { passwordHash: await hashPassword(body.password) } });
  if (target.id !== user.id) await revokeUserSessions(target.id);
  await audit({ userId: user.id, siteId: target.siteId, action: "PASSWORD_RESET", entity: "User", entityId: target.id, ip });
  return ok({ ok: true });
});
