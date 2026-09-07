import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/Card";
import { compileDpr, type DprData } from "@/lib/dpr";
import { prisma } from "@/lib/prisma";
import { dateKeyToDate, istDateKey } from "@/lib/format";
import { DprView } from "./DprView";

export default async function DprPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requirePage("dpr.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const today = istDateKey();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const dpr = await prisma.dPR.findUnique({ where: { siteId_date: { siteId: site.id, date: dateKeyToDate(date) } }, include: { submittedBy: { select: { name: true } } } });
  const submitted = dpr?.status === "SUBMITTED" && dpr.snapshot;
  const data = submitted ? (dpr.snapshot as unknown as DprData) : await compileDpr(site.id, date);
  return (
    <DprView
      siteId={site.id}
      siteName={`${site.name}, ${site.city}`}
      date={date}
      today={today}
      data={data}
      submitted={submitted ? { by: dpr.submittedBy?.name ?? "", at: dpr.submittedAt?.toISOString() ?? "", remark: dpr.remark ?? "" } : null}
      canSubmit={can(user.role, "dpr.submit") && date <= today}
    />
  );
}
