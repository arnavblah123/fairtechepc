import Link from "next/link";
import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card, EmptyState } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Bi } from "@/components/ui/Bi";
import { TRADE_LABELS } from "@/lib/labels";
import { ExportLink } from "@/components/forms/ExportLink";

export default async function WorkersPage() {
  const user = await requirePage("worker.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const workers = await prisma.worker.findMany({ where: { siteId: site.id }, orderBy: [{ active: "desc" }, { code: "asc" }] });
  const byTrade = new Map<string, typeof workers>();
  for (const w of workers.filter((w) => w.active)) {
    byTrade.set(w.trade, [...(byTrade.get(w.trade) ?? []), w]);
  }
  const inactive = workers.filter((w) => !w.active);
  return (
    <div>
      <PageHeader title="Labour master" hi="मज़दूर सूची" back="/more" action={can(user.role, "export.csv") ? <ExportLink href={`/api/workers/export?siteId=${site.id}`} /> : undefined} />
      {can(user.role, "worker.manage") && (
        <LinkButton href="/workers/new" full size="lg" className="mb-4">
          + <Bi en="Add worker" hi="नया मज़दूर" />
        </LinkButton>
      )}
      <div className="space-y-4">
        {[...byTrade.entries()].map(([trade, list]) => (
          <Card key={trade} title={`${TRADE_LABELS[trade as keyof typeof TRADE_LABELS].en} (${list.length})`} hi={TRADE_LABELS[trade as keyof typeof TRADE_LABELS].hi}>
            <ul className="divide-y">
              {list.map((w) => (
                <li key={w.id}>
                  <Link href={`/workers/${w.id}`} className="flex min-h-[56px] items-center gap-3 py-2">
                    {w.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">{w.name[0]}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{w.name}</div>
                      <div className="text-xs text-slate-500">
                        {w.code}
                        {w.contractorName ? ` · ${w.contractorName}` : ""}
                        {w.phone ? ` · ${w.phone}` : ""}
                      </div>
                    </div>
                    <span className="text-slate-400">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {inactive.length > 0 && (
          <Card title={`Left / inactive (${inactive.length})`} hi="निष्क्रिय">
            <ul className="divide-y">
              {inactive.map((w) => (
                <li key={w.id}>
                  <Link href={`/workers/${w.id}`} className="flex min-h-[48px] items-center justify-between py-2 text-slate-500">
                    <span>
                      {w.code} · {w.name}
                    </span>
                    <Badge tone="red">Inactive</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {workers.length === 0 && <EmptyState en="No workers yet." hi="अभी कोई मज़दूर नहीं।" />}
      </div>
    </div>
  );
}
