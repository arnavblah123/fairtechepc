import { withAuth, csvResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveSiteId } from "@/lib/site";
import { formatDate, titleCase } from "@/lib/format";

export const GET = withAuth("export.csv", async ({ user, req }) => {
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const workers = await prisma.worker.findMany({ where: { siteId }, orderBy: { code: "asc" }, include: { wageRates: { orderBy: { effectiveFrom: "desc" }, take: 1 } } });
  return csvResponse(
    "workers.csv",
    workers.map((w) => ({
      Code: w.code,
      Name: w.name,
      Trade: titleCase(w.trade),
      Phone: w.phone ?? "",
      "Wage type": w.wageType === "PER_DAY" ? "Per day" : "Per hour",
      "Current rate": w.wageRates[0] ? Number(w.wageRates[0].rate) : "",
      Contractor: w.contractorName ?? "",
      "ID ref": w.idDocRef ?? "",
      Joined: formatDate(w.joiningDate),
      Active: w.active ? "Yes" : "No",
    })),
  );
});
