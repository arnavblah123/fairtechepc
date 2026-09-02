import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./auth";
import { can, type Capability } from "./permissions";

/**
 * For server pages: returns the user, or 404s when the role lacks the capability.
 * 404 (not 403) so restricted screens do not even reveal that they exist.
 */
export async function requirePage(cap?: Capability): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (cap && !can(user.role, cap)) notFound();
  return user;
}
