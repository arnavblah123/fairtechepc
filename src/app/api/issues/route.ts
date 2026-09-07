import { withAuth, parseBody, ok } from "@/lib/api";
import { issueSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";

export const GET = withAuth("dpr.view", async ({ user, req }) => {
  const url = new URL(req.url);
  const siteId = await resolveSiteId(user, url.searchParams.get("siteId"));
  const showResolved = url.searchParams.get("resolved") === "1";
  const issues = await prisma.issue.findMany({
    where: { siteId, voidedAt: null, status: showResolved ? "RESOLVED" : { not: "RESOLVED" } },
    orderBy: [{ severity: "desc" }, { raisedAt: "asc" }],
    include: { raisedBy: { select: { name: true } }, job: { select: { jobNumber: true } } },
  });
  return ok({ issues });
});

export const POST = withAuth("issue.raise", async ({ user, req, ip }) => {
  const body = await parseBody(req, issueSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const issue = await prisma.issue.create({
    data: {
      siteId,
      jobId: body.jobId || null,
      category: body.category,
      severity: body.severity,
      description: body.description,
      neededFromHO: body.neededFromHO || null,
      photoUrl: body.photoUrl || null,
      raisedById: user.id,
    },
  });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "Issue", entityId: issue.id, newValues: issue, ip });
  return ok({ id: issue.id }, 201);
});
