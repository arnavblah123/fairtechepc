import { withAuth, csvResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveSiteId } from "@/lib/site";
import { formatDate, dateKeyToDate } from "@/lib/format";
import { dateKey } from "@/lib/validation";
import { z } from "zod";

export const GET = withAuth("export.csv", async ({ user, req }) => {
  const url = new URL(req.url);
  const siteId = await resolveSiteId(user, url.searchParams.get("siteId"));
  const q = z.object({ from: dateKey, to: dateKey }).parse({ from: url.searchParams.get("from"), to: url.searchParams.get("to") });
  const rows = await prisma.attendance.findMany({
    where: { siteId, date: { gte: dateKeyToDate(q.from), lte: dateKeyToDate(q.to) } },
    orderBy: [{ date: "asc" }, { worker: { code: "asc" } }],
    include: { worker: { select: { code: true, name: true, trade: true } }, markedBy: { select: { name: true } } },
  });
  return csvResponse(
    `attendance-${q.from}-to-${q.to}.csv`,
    rows.map((r) => ({
      Date: formatDate(r.date),
      Code: r.worker.code,
      Name: r.worker.name,
      Trade: r.worker.trade,
      Status: r.status,
      In: r.inTime ?? "",
      Out: r.outTime ?? "",
      "OT hrs": Number(r.otHours),
      Remark: r.remark ?? "",
      "Marked by": r.markedBy.name,
    })),
  );
});
