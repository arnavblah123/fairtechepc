import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { getCurrentSite } from "@/lib/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { BUNDLED_SHEETS, sheetStatus, sheetTotals, sheetWarnings } from "@/lib/expense-sheets";
import { normalizePartyName } from "@/lib/parties";
import { ImportSheetPanel } from "./ImportSheetPanel";

export default async function ImportSheetsPage() {
  const user = await requirePage("cash.move");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const [people, statuses] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, OR: [{ siteId: site.id }, { role: "SUPERADMIN" }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    Promise.all(BUNDLED_SHEETS.map((s) => sheetStatus(prisma, site.id, s))),
  ]);
  const sheets = BUNDLED_SHEETS.map((s, i) => ({
    id: s.id,
    title: s.title,
    holderName: s.holder,
    // Pre-select the account whose name matches the sheet, else whoever the entered rows already belong to.
    matchedHolderId: statuses[i].holder?.id ?? people.find((p) => normalizePartyName(p.name) === normalizePartyName(s.holder))?.id ?? null,
    cash: s.cash.map((c, n) => ({ n: n + 1, date: c.date, kind: c.kind, amount: c.amount, memo: c.memo ?? null })),
    lines: s.lines.map((l, n) => ({ n: n + 1, date: l.date, category: l.category, amount: l.amount, description: l.description, payee: l.payee ?? null })),
    totals: sheetTotals(s),
    warnings: sheetWarnings(s),
    status: statuses[i],
  }));
  return (
    <div>
      <PageHeader title="Import expense sheet" hi="खर्च शीट दर्ज करें" back="/more" />
      <ImportSheetPanel siteId={site.id} siteName={site.name} people={people} sheets={sheets} />
    </div>
  );
}
