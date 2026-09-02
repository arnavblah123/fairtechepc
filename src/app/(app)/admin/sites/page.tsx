import Link from "next/link";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Bi } from "@/components/ui/Bi";
import { formatINR } from "@/lib/format";

export default async function SitesPage() {
  await requirePage("site.manage");
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { jobs: true, users: true, workers: true } } } });
  return (
    <div>
      <PageHeader title="Sites" hi="साइट" back="/more" />
      <LinkButton href="/admin/sites/new" full size="lg" className="mb-4">
        + <Bi en="Add site" hi="नई साइट" />
      </LinkButton>
      <Card>
        <ul className="divide-y">
          {sites.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/sites/${s.id}`} className="flex min-h-[64px] items-center justify-between py-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    {s.name} <Badge tone="blue">{s.code}</Badge> {!s.active && <Badge tone="red">Inactive</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {s.city} · {s._count.jobs} jobs · {s._count.workers} workers · {s._count.users} users · petty cash alert below {formatINR(s.pettyCashThreshold)}
                  </div>
                </div>
                <span className="text-slate-400">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
