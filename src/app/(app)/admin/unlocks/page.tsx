import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { getCurrentSite } from "@/lib/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { formatDate, formatDateTime } from "@/lib/format";
import { UnlockForm } from "./UnlockForm";

export default async function UnlocksPage() {
  const user = await requirePage("backdate.unlock");
  const site = await getCurrentSite(user);
  const unlocks = await prisma.backdateUnlock.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { site: { select: { code: true } }, unlockedBy: { select: { name: true } } },
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Unlock past date" hi="पुरानी तारीख़ खोलें" back="/more" />
      {site && <UnlockForm siteId={site.id} siteName={site.name} />}
      <Card title="Recent unlocks" hi="हाल के अनलॉक">
        <ul className="divide-y text-sm">
          {unlocks.map((u) => (
            <li key={u.id} className="py-2">
              <div className="font-semibold">
                {u.site.code} · {u.module} · {formatDate(u.date)}
                {u.expiresAt > new Date() && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">active</span>}
              </div>
              <div className="text-xs text-slate-500">
                {u.reason} · by {u.unlockedBy.name} · until {formatDateTime(u.expiresAt)}
              </div>
            </li>
          ))}
          {unlocks.length === 0 && <li className="py-2 text-slate-500">No unlocks yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
