import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import { AuthError } from "./auth";

export const SITE_COOKIE = "ft_site";

export type SiteRef = { id: string; name: string; code: string; city: string };

/**
 * Resolve the site the current user is working in.
 * Site-bound roles are locked to their own site. Superadmin picks a site (cookie) and
 * falls back to the first active site.
 */
export async function getCurrentSite(user: SessionUser): Promise<SiteRef | null> {
  if (user.role !== "SUPERADMIN") return user.site;
  const jar = await cookies();
  const wanted = jar.get(SITE_COOKIE)?.value;
  const select = { id: true, name: true, code: true, city: true };
  if (wanted) {
    const s = await prisma.site.findFirst({ where: { id: wanted, active: true }, select });
    if (s) return s;
  }
  return prisma.site.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" }, select });
}

/**
 * For API routes: the siteId a user is allowed to act on. Superadmin may pass any siteId;
 * everyone else is forced to their own site regardless of what they send.
 */
export async function resolveSiteId(user: SessionUser, requested?: string | null): Promise<string> {
  if (user.role === "SUPERADMIN") {
    if (requested) return requested;
    const s = await getCurrentSite(user);
    if (!s) throw new AuthError(403, "No site selected");
    return s.id;
  }
  if (!user.siteId) throw new AuthError(403, "Your account is not attached to a site");
  if (requested && requested !== user.siteId) throw new AuthError(403, "You cannot access another site");
  return user.siteId;
}

/** Throws unless the user may see records of this site. */
export function assertSiteAccess(user: SessionUser, siteId: string) {
  if (user.role === "SUPERADMIN") return;
  if (user.siteId !== siteId) throw new AuthError(403, "You cannot access another site");
}
