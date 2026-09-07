import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExportLink } from "@/components/forms/ExportLink";
import { AttendanceBoard } from "./AttendanceBoard";
import { istDateKey, addDays, dateKeyToDate, dateToKey } from "@/lib/format";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requirePage("attendance.mark");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const today = istDateKey();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const dateObj = dateKeyToDate(date);
  const [workers, rows, muster, holiday] = await Promise.all([
    prisma.worker.findMany({ where: { siteId: site.id, active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, trade: true, photoUrl: true } }),
    prisma.attendance.findMany({ where: { siteId: site.id, date: dateObj } }),
    prisma.sitePhoto.findFirst({ where: { siteId: site.id, kind: "MUSTER", date: dateObj, voidedAt: null } }),
    prisma.holiday.findUnique({ where: { siteId_date: { siteId: site.id, date: dateObj } } }),
  ]);
  const from = addDays(today, -30);
  return (
    <div>
      <PageHeader
        title="Attendance"
        hi="हाज़िरी"
        action={can(user.role, "export.csv") ? <ExportLink href={`/api/attendance/export?siteId=${site.id}&from=${from}&to=${today}`} /> : undefined}
      />
      <AttendanceBoard
        siteId={site.id}
        date={date}
        today={today}
        yesterday={addDays(today, -1)}
        holiday={holiday?.name ?? null}
        musterUrl={muster?.url ?? null}
        workers={workers}
        initialRows={rows.map((r) => ({
          workerId: r.workerId,
          status: r.status,
          inTime: r.inTime,
          outTime: r.outTime,
          otHours: Number(r.otHours),
          date: dateToKey(r.date),
        }))}
      />
    </div>
  );
}
