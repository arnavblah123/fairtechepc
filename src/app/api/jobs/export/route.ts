import { withAuth, csvResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveSiteId } from "@/lib/site";
import { formatDate } from "@/lib/format";

export const GET = withAuth("export.csv", async ({ user, req }) => {
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const jobs = await prisma.job.findMany({ where: { siteId }, orderBy: { jobNumber: "asc" }, include: { stages: { where: { voidedAt: null } } } });
  return csvResponse(
    "jobs.csv",
    jobs.map((j) => ({
      "Job No": j.jobNumber,
      Name: j.name,
      Client: j.clientName,
      "Planned MT": Number(j.plannedTonnage),
      "Planned start": formatDate(j.plannedStart),
      "Planned end": formatDate(j.plannedEnd),
      Status: j.voidedAt ? "VOID" : j.status,
      Stages: j.stages.length,
      "Welding norm kg/MT": j.weldingNormKgPerMT ? Number(j.weldingNormKgPerMT) : "",
    })),
  );
});
