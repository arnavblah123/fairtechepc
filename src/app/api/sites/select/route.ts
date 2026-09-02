import { cookies } from "next/headers";
import { z } from "zod";
import { withAuth, parseBody, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { SITE_COOKIE } from "@/lib/site";

/** Superadmin switches the site they are looking at. */
export const POST = withAuth("site.manage", async ({ req }) => {
  const { siteId } = await parseBody(req, z.object({ siteId: z.string().min(1) }));
  await prisma.site.findFirstOrThrow({ where: { id: siteId, active: true } });
  const jar = await cookies();
  jar.set(SITE_COOKIE, siteId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
  return ok({ ok: true });
});
