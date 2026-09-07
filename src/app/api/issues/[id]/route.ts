import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { issueActionSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { assertSiteAccess } from "@/lib/site";
import { can } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";

/** Status transitions. Acknowledge = head office has seen it (superadmin). Resolve needs a note. */
export const PATCH = withAuth<{ id: string }>(null, async ({ user, req, params, ip }) => {
  const body = await parseBody(req, issueActionSchema);
  const before = await prisma.issue.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!before) throw new ApiError(404, "Issue not found");
  assertSiteAccess(user, before.siteId);
  if (before.status === "RESOLVED") throw new ApiError(400, "Already resolved");

  if (body.action === "ACKNOWLEDGE") {
    if (user.role !== "SUPERADMIN") throw new AuthError(403, "Only Arnav can acknowledge");
  } else if (!can(user.role, "issue.resolve")) {
    throw new AuthError(403, "Not allowed for your role");
  }
  if (body.action === "RESOLVE" && !(body.note ?? "").trim()) throw new ApiError(400, "Write what was done to resolve it");

  const after = await prisma.issue.update({
    where: { id: before.id },
    data:
      body.action === "ACKNOWLEDGE"
        ? { status: "ACKNOWLEDGED", acknowledgedAt: new Date() }
        : body.action === "IN_PROGRESS"
          ? { status: "IN_PROGRESS", acknowledgedAt: before.acknowledgedAt ?? new Date() }
          : { status: "RESOLVED", resolvedAt: new Date(), resolutionNote: body.note, closedById: user.id },
  });
  await audit({ userId: user.id, siteId: after.siteId, action: body.action === "RESOLVE" ? "APPROVE" : "UPDATE", entity: "Issue", entityId: after.id, oldValues: { status: before.status }, newValues: { status: after.status, note: body.note }, ip });
  return ok({ ok: true });
});
