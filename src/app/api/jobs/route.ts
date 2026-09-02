import { withAuth, parseBody, ok } from "@/lib/api";
import { jobSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { nextJobNumber } from "@/lib/jobs";
import { dateKeyToDate } from "@/lib/format";
import { Prisma } from "@prisma/client";

export const GET = withAuth("job.view", async ({ user, req }) => {
  const url = new URL(req.url);
  const siteId = await resolveSiteId(user, url.searchParams.get("siteId"));
  const jobs = await prisma.job.findMany({
    where: { siteId, voidedAt: null },
    orderBy: { jobNumber: "asc" },
    select: { id: true, jobNumber: true, name: true, clientName: true, plannedTonnage: true, plannedStart: true, plannedEnd: true, status: true },
  });
  return ok({ jobs });
});

export const POST = withAuth("job.manage", async ({ user, req, ip }) => {
  const body = await parseBody(req, jobSchema);
  const siteId = await resolveSiteId(user, body.siteId);
  // Retry a couple of times in case two admins create a job at the same instant.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const job = await prisma.$transaction(async (tx) => {
        const jobNumber = await nextJobNumber(tx, siteId);
        const created = await tx.job.create({
          data: {
            siteId,
            jobNumber,
            name: body.name,
            clientName: body.clientName,
            description: body.description || null,
            drawingRef: body.drawingRef || null,
            plannedTonnage: body.plannedTonnage,
            plannedStart: dateKeyToDate(body.plannedStart),
            plannedEnd: dateKeyToDate(body.plannedEnd),
            weldingNormKgPerMT: body.weldingNormKgPerMT ?? null,
            status: body.status,
            createdById: user.id,
          },
        });
        await audit({ userId: user.id, siteId, action: "CREATE", entity: "Job", entityId: created.id, newValues: created, ip }, tx);
        return created;
      });
      return ok({ id: job.id, jobNumber: job.jobNumber }, 201);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
  throw new Error("unreachable");
});
