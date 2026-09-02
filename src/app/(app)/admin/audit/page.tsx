import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Badge } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePage("audit.view");
  const page = Math.max(1, Number((await searchParams).page ?? 1));
  const take = 50;
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * take,
    take,
    include: { user: { select: { name: true } }, site: { select: { code: true } } },
  });
  const tone = (a: string) => (a === "VOID" || a === "REJECT" ? "red" : a === "APPROVE" || a === "CREATE" ? "green" : a === "UNLOCK" ? "amber" : "slate");
  return (
    <div>
      <PageHeader title="Audit log" hi="ऑडिट लॉग" back="/more" />
      <Card>
        <ul className="divide-y text-sm">
          {logs.map((l) => (
            <li key={l.id} className="py-2">
              <div className="flex items-center gap-2">
                <Badge tone={tone(l.action)}>{l.action}</Badge>
                <span className="font-semibold">{l.entity}</span>
                {l.site && <span className="text-xs text-slate-500">{l.site.code}</span>}
              </div>
              <div className="text-xs text-slate-500">
                {l.user.name} · {formatDateTime(l.createdAt)} {l.entityId ? `· ${l.entityId.slice(-6)}` : ""}
              </div>
              {(l.oldValues || l.newValues) && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-brand">details</summary>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[11px]">{JSON.stringify({ old: l.oldValues, new: l.newValues }, null, 1)}</pre>
                </details>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between text-sm">
          {page > 1 ? <a className="font-semibold text-brand" href={`?page=${page - 1}`}>‹ Newer</a> : <span />}
          {logs.length === take && <a className="font-semibold text-brand" href={`?page=${page + 1}`}>Older ›</a>}
        </div>
      </Card>
    </div>
  );
}
