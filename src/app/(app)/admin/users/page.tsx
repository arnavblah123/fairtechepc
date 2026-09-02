import Link from "next/link";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Bi } from "@/components/ui/Bi";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { ExportLink } from "@/components/forms/ExportLink";

export default async function UsersPage() {
  await requirePage("user.manage");
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    include: { site: { select: { name: true } } },
  });
  return (
    <div>
      <PageHeader title="Users" hi="यूज़र" back="/more" action={<ExportLink href="/api/users/export" />} />
      <LinkButton href="/admin/users/new" full size="lg" className="mb-4">
        + <Bi en="Add user" hi="नया यूज़र" />
      </LinkButton>
      <Card>
        <ul className="divide-y">
          {users.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/users/${u.id}`} className="flex min-h-[64px] items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{u.name}</span>
                    {!u.active && <Badge tone="red">Inactive</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">
                    @{u.username} · {ROLE_LABELS[u.role].en}
                    {u.site ? ` · ${u.site.name}` : ""}
                  </div>
                  <div className="text-xs text-slate-400">Last login: {formatDateTime(u.lastLoginAt)}</div>
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
