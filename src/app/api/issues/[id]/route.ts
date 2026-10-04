import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { issueActionSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { assertSiteAccess } from "@/lib/site";
import { can } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { transitionIssue } from "@/lib/decisions";

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
  await transitionIssue(before, body.action, body.note || null, { id: user.id, ip });
  return ok({ ok: true });
});
