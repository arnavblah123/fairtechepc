import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/Card";
import { WagesBoard } from "./WagesBoard";
import { dateKeyToDate, dateToKey, istDateKey } from "@/lib/format";
import { periodEnd } from "@/lib/wages";

export default async function WagesPage({ searchParams }: { searchParams: Promise<{ period?: string; start?: string }> }) {
  const user = await requirePage("wage.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const sp = await searchParams;
  const period = sp.period === "WEEKLY" ? "WEEKLY" : "MONTHLY";
  const today = istDateKey();
  const defaultStart = period === "MONTHLY" ? today.slice(0, 8) + "01" : today;
  const start = /^\d{4}-\d{2}-\d{2}$/.test(sp.start ?? "") ? sp.start! : defaultStart;
  const sheets = await prisma.wageSheet.findMany({
    where: { siteId: site.id, period, periodStart: dateKeyToDate(start), voidedAt: null },
    orderBy: { worker: { code: "asc" } },
    include: { worker: { select: { code: true, name: true, trade: true, wageType: true } } },
  });
  return (
    <WagesBoard
      siteId={site.id}
      period={period}
      start={start}
      end={periodEnd(period, start)}
      sheets={sheets.map((s) => ({
        id: s.id, code: s.worker.code, name: s.worker.name, trade: s.worker.trade, wageType: s.worker.wageType,
        daysPresent: Number(s.daysPresent), hours: Number(s.hours), otHours: Number(s.otHours),
        gross: Number(s.grossWage), advances: Number(s.advancesDeducted), net: Number(s.netPayable), status: s.status,
        periodEnd: dateToKey(s.periodEnd),
      }))}
    />
  );
}
