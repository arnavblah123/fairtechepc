import { withAuth, csvResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveSiteId } from "@/lib/site";
import { formatDate, dateKeyToDate } from "@/lib/format";
import { dateKey } from "@/lib/validation";
import { z } from "zod";

export const GET = withAuth("export.csv", async ({ user, req }) => {
  const url = new URL(req.url);
  const siteId = await resolveSiteId(user, url.searchParams.get("siteId"));
  const q = z.object({ period: z.enum(["WEEKLY", "MONTHLY"]), start: dateKey }).parse({ period: url.searchParams.get("period"), start: url.searchParams.get("start") });
  const sheets = await prisma.wageSheet.findMany({
    where: { siteId, period: q.period, periodStart: dateKeyToDate(q.start), voidedAt: null },
    orderBy: { worker: { code: "asc" } },
    include: { worker: { select: { code: true, name: true, trade: true, wageType: true, contractorName: true } } },
  });
  return csvResponse(
    `wages-${q.start}.csv`,
    sheets.map((s) => ({
      Code: s.worker.code,
      Name: s.worker.name,
      Trade: s.worker.trade,
      Contractor: s.worker.contractorName ?? "",
      "Wage type": s.worker.wageType,
      Period: `${formatDate(s.periodStart)} to ${formatDate(s.periodEnd)}`,
      "Days present": Number(s.daysPresent),
      Hours: Number(s.hours),
      "OT hours": Number(s.otHours),
      "Gross ₹": Number(s.grossWage),
      "Advances ₹": Number(s.advancesDeducted),
      "Net payable ₹": Number(s.netPayable),
      Status: s.status,
    })),
  );
});
