import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { HolidayManager } from "./HolidayManager";
import { dateToKey } from "@/lib/format";

export default async function HolidaysPage() {
  const user = await requirePage("holiday.manage");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const holidays = await prisma.holiday.findMany({ where: { siteId: site.id }, orderBy: { date: "asc" } });
  return (
    <div>
      <PageHeader title="Site holidays" hi="साइट छुट्टियाँ" back="/more" />
      <HolidayManager siteId={site.id} holidays={holidays.map((h) => ({ id: h.id, date: dateToKey(h.date), name: h.name }))} />
    </div>
  );
}
