"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card, Stat } from "@/components/ui/Card";
import { formatDate, formatINR, titleCase } from "@/lib/format";
import type { ImportReport, SheetStatus } from "@/lib/expense-sheets";

type Person = { id: string; name: string; role: string };
type SheetView = {
  id: string;
  title: string;
  holderName: string;
  matchedHolderId: string | null;
  cash: { n: number; date: string; kind: string; amount: number; memo: string | null }[];
  lines: { n: number; date: string; category: string; amount: number; description: string; payee: string | null }[];
  totals: { received: number; spent: number; inHand: number };
  warnings: string[];
  status: SheetStatus;
};

export function ImportSheetPanel({ siteId, siteName, people, sheets }: { siteId: string; siteName: string; people: Person[]; sheets: SheetView[] }) {
  if (sheets.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500">No expense sheet is bundled with this version of the app. Add one under data/expense-sheets/ and deploy.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {sheets.map((s) => (
        <SheetCard key={s.id} siteId={siteId} siteName={siteName} people={people} sheet={s} />
      ))}
    </div>
  );
}

function SheetCard({ siteId, siteName, people, sheet }: { siteId: string; siteName: string; people: Person[]; sheet: SheetView }) {
  const router = useRouter();
  const toast = useToast();
  const [holderId, setHolderId] = useState(sheet.matchedHolderId ?? "");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<"preview" | "enter" | null>(null);
  const [showLines, setShowLines] = useState(false);

  const st = sheet.status;
  const allIn = st.cashEntered >= st.cashTotal && st.linesEntered >= st.linesTotal;
  const partlyIn = !allIn && (st.cashEntered > 0 || st.linesEntered > 0);
  const lockedHolder = st.holder; // once rows are in, the rest must go to the same person

  async function run(dryRun: boolean) {
    if (!holderId) {
      toast.error("Choose whose cash this is");
      return;
    }
    setBusy(dryRun ? "preview" : "enter");
    try {
      const r = await api<ImportReport>(`/api/import/expense-sheet?siteId=${siteId}`, { body: { sheetId: sheet.id, holderId, dryRun } });
      setReport(r);
      setShowLines(true);
      if (!dryRun) {
        toast.saved();
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title={sheet.title} hi={`शीट · ${sheet.holderName}`}>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Received" hi="मिला" value={<span className="text-lg">{formatINR(sheet.totals.received)}</span>} />
        <Stat label="Spent" hi="खर्च" value={<span className="text-lg">{formatINR(sheet.totals.spent)}</span>} />
        <Stat label="In hand" hi="बचा" value={<span className="text-lg">{formatINR(sheet.totals.inHand)}</span>} tone="green" />
      </div>

      {sheet.warnings.map((w) => (
        <p key={w} className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">⚠ {w}</p>
      ))}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {allIn ? (
          <Badge tone="green">Entered · {st.linesPending} awaiting approval · {st.linesApproved} approved</Badge>
        ) : partlyIn ? (
          <Badge tone="amber">Partly entered: {st.cashEntered}/{st.cashTotal} cash, {st.linesEntered}/{st.linesTotal} lines</Badge>
        ) : (
          <Badge>Not entered yet</Badge>
        )}
        {lockedHolder && <span className="text-slate-500">charged to {lockedHolder.name}</span>}
      </div>

      <div className="mt-4 space-y-3">
        <Select
          label="Whose cash is this?"
          hi="किसका कैश"
          value={holderId}
          onChange={(e) => setHolderId(e.target.value)}
          disabled={!!lockedHolder || busy !== null}
          hint={
            lockedHolder
              ? "Rows already entered belong to this person, so the rest go to them too."
              : sheet.matchedHolderId
                ? `Matched by name to the sheet (${sheet.holderName}).`
                : `Nobody named "${sheet.holderName}" has a login. Pick their account, or add them under Users & passwords first.`
          }
        >
          <option value="">— choose —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {titleCase(p.role)}
            </option>
          ))}
        </Select>

        <p className="text-xs text-slate-500">
          Enters the cash received as advances in their cash-in-hand ledger and the {siteName} cash book, and every line as an expense charged to them.
          Nothing is approved here: approve the lines on the dashboard as usual. Running it again never duplicates anything.
        </p>

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" loading={busy === "preview"} disabled={busy !== null} onClick={() => run(true)}>
            <Bi en="Preview" hi="पहले देखें" />
          </Button>
          <Button type="button" className="flex-1" loading={busy === "enter"} disabled={busy !== null || allIn} onClick={() => run(false)}>
            <Bi en={allIn ? "Already entered" : "Enter now (pending)"} hi={allIn ? "दर्ज हो चुका" : "दर्ज करें"} />
          </Button>
        </div>
      </div>

      {report && <ReportView report={report} />}

      <button type="button" className="mt-4 text-sm font-semibold text-brand" onClick={() => setShowLines((v) => !v)}>
        {showLines ? "Hide" : "Show"} the sheet ({sheet.cash.length} cash rows, {sheet.lines.length} lines)
      </button>
      {showLines && !report && (
        <div className="mt-2 space-y-3 text-sm">
          <ul className="divide-y">
            {sheet.cash.map((c) => (
              <li key={c.n} className="flex items-center justify-between py-1.5">
                <span>
                  <span className="text-slate-500">{formatDate(c.date)}</span> · {c.kind === "ADVANCE" ? "Advance" : "Top-up"}
                  {c.memo && <span className="text-slate-500"> · {c.memo}</span>}
                </span>
                <span className="font-semibold text-green-700">+{formatINR(c.amount)}</span>
              </li>
            ))}
          </ul>
          <ul className="divide-y">
            {sheet.lines.map((l) => (
              <li key={l.n} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0">
                  <span className="text-slate-500">{formatDate(l.date)}</span> · {l.description}
                  {l.payee && <span className="text-slate-500"> → {l.payee}</span>}
                  <span className="ml-1 text-xs text-slate-400">{l.category}</span>
                </span>
                <span className="shrink-0 font-semibold">{formatINR(l.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function OutcomeBadge({ outcome, existingStatus }: { outcome: string; existingStatus?: string }) {
  if (outcome === "entered") return <Badge tone="green">entered</Badge>;
  if (outcome === "would-enter") return <Badge tone="blue">will enter</Badge>;
  return <Badge tone={existingStatus === "VOIDED" ? "red" : "slate"}>{existingStatus ? `in app · ${existingStatus.toLowerCase()}` : "in app"}</Badge>;
}

function ReportView({ report }: { report: ImportReport }) {
  const cashNew = report.cash.filter((c) => c.outcome !== "exists").length;
  const linesNew = report.lines.filter((l) => l.outcome !== "exists").length;
  const misc = report.lines.filter((l) => l.filedAsMisc);
  return (
    <div className="mt-4 space-y-3 rounded-xl border-2 border-slate-200 p-3 text-sm">
      <div className="font-semibold">
        {report.dryRun ? "Preview" : "Done"} · {report.holder.name}
        <span className="ml-1 font-normal text-slate-500">
          — {cashNew} cash row{cashNew === 1 ? "" : "s"} and {linesNew} line{linesNew === 1 ? "" : "s"} {report.dryRun ? "to enter" : "entered"},{" "}
          {report.cash.length - cashNew + report.lines.length - linesNew} already in.
        </span>
      </div>
      {report.balance && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cash in hand" hi="हाथ में" value={<span className="text-lg">{formatINR(report.balance.inHand)}</span>} tone="blue" />
          <Stat label="Awaiting approval" hi="मंज़ूरी बाकी" value={<span className="text-lg">{formatINR(report.balance.awaitingApproval)}</span>} tone="amber" />
        </div>
      )}
      {misc.length > 0 && (
        <p className="rounded-xl bg-amber-50 p-2 text-amber-900">
          {misc.length} line{misc.length === 1 ? "" : "s"} paid to people not on the labour master went under Miscellaneous with the name kept as payee:{" "}
          {misc.map((l) => l.payee ?? l.description).join(", ")}. Add them to the labour master and re-categorise in the app if wanted.
        </p>
      )}
      <ul className="divide-y">
        {report.cash.map((c) => (
          <li key={`c${c.n}`} className="flex items-center justify-between gap-2 py-1.5">
            <span className="min-w-0">
              <span className="text-slate-500">{formatDate(c.date)}</span> · {c.kind === "ADVANCE" ? "Advance" : "Top-up"}
              {c.memo && <span className="text-slate-500"> · {c.memo}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <OutcomeBadge outcome={c.outcome} />
              <span className="font-semibold text-green-700">+{formatINR(c.amount)}</span>
            </span>
          </li>
        ))}
      </ul>
      <ul className="divide-y">
        {report.lines.map((l) => (
          <li key={`l${l.n}`} className="flex items-center justify-between gap-2 py-1.5">
            <span className="min-w-0">
              <span className="text-slate-500">{formatDate(l.date)}</span> · {l.description}
              {l.payee && <span className="text-slate-500"> → {l.payee}</span>}
              <span className="ml-1 text-xs text-slate-400">{l.category}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <OutcomeBadge outcome={l.outcome} existingStatus={l.existingStatus} />
              <span className="font-semibold">{formatINR(l.amount)}</span>
            </span>
          </li>
        ))}
      </ul>
      {!report.dryRun && linesNew > 0 && (
        <p className="text-slate-600">
          The lines are <b>pending</b>. Approve them from the dashboard like any other expense; each approval debits {report.holder.name}&apos;s cash in hand.
        </p>
      )}
    </div>
  );
}
