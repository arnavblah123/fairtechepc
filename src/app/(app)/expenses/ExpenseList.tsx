"use client";
import Link from "next/link";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card } from "@/components/ui/Card";
import { PhotoLink } from "@/components/forms/PhotoLink";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { formatDate, formatINR } from "@/lib/format";

type Expense = {
  id: string; billId: string | null; billNo: string | null; date: string; amount: number; category: string; description: string;
  entryType: string; paidFrom: string; payee: string | null; partyId: string | null; status: string; spentBy: string;
  job: string | null; worker: string | null; machine: string | null; problem: string | null; bill: string | null; note: string | null;
};
const TONE = { PENDING: "amber", APPROVED: "green", QUERIED: "blue", REJECTED: "red" } as const;
const TABS: [string | null, string][] = [[null, "All"], ["PENDING", "Waiting"], ["APPROVED", "Approved"], ["QUERIED", "Query"], ["REJECTED", "Rejected"]];

/** Bills with their lines grouped together; one tap approves a whole bill. */
export function ExpenseList({ expenses, canCreate, canApprove, canDelete, showOwnCash, inHand, pending, activeStatus }: {
  expenses: Expense[]; canCreate: boolean; canApprove: boolean; canDelete: boolean; showOwnCash: boolean; inHand: number; pending: number; activeStatus: string | null;
}) {
  const { busy, submit } = useSubmit();
  const decide = (url: string, decision: "APPROVED" | "REJECTED" | "QUERIED") => {
    if (decision === "APPROVED") return submit(() => api(url, { body: { decision } }));
    const note = window.prompt(decision === "QUERIED" ? "What do you want explained?" : "Why is it rejected?") ?? "";
    if (note.trim()) submit(() => api(url, { body: { decision, note } }));
  };

  const groups: { key: string; billId: string | null; payee: string | null; partyId: string | null; date: string; spentBy: string; billNo: string | null; photo: string | null; paidFrom: string; lines: Expense[] }[] = [];
  for (const e of expenses) {
    const key = e.billId ?? e.id;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, billId: e.billId, payee: e.payee, partyId: e.partyId, date: e.date, spentBy: e.spentBy, billNo: e.billNo, photo: e.bill, paidFrom: e.paidFrom, lines: [] };
      groups.push(g);
    }
    g.lines.push(e);
  }
  const approvedTotal = expenses.filter((e) => e.status === "APPROVED").reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-4">
      {showOwnCash && (
        <Card>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">My cash in hand</div><div className={`text-xl font-bold ${inHand < 0 ? "text-red-600" : ""}`}>{formatINR(inHand)}</div></div>
            <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Waiting approval</div><div className="text-xl font-bold text-amber-600">{formatINR(pending)}</div></div>
          </div>
        </Card>
      )}
      {canCreate && (
        <Link href="/expenses/new" className="flex min-h-[56px] items-center justify-center rounded-xl bg-brand text-lg font-semibold text-white">+ <Bi en="Add bill / expense" hi="बिल / खर्च भरें" /></Link>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
        {TABS.map(([v, label]) => (
          <Link key={label} href={v ? `/expenses?status=${v}` : "/expenses"} className={`rounded-full px-3 py-1.5 ${activeStatus === v ? "bg-brand text-white" : "bg-white"}`}>{label}</Link>
        ))}
        <Link href="/vendors" className="ml-auto rounded-full border-2 border-slate-300 bg-white px-3 py-1 text-xs">Vendor ledger →</Link>
      </div>

      {groups.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-slate-500">Nothing here yet.</p></Card>
      ) : (
        groups.map((g) => {
          const total = g.lines.reduce((a, l) => a + l.amount, 0);
          const undecided = g.lines.filter((l) => l.status !== "APPROVED");
          const allApproved = undecided.length === 0;
          return (
            <Card key={g.key} className="!p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold">
                    {g.partyId ? <Link href={`/vendors/${g.partyId}`} className="text-brand">{g.payee}</Link> : (g.payee ?? "—")}
                    {g.billNo && <span className="ml-1 text-xs font-normal text-slate-500">bill {g.billNo}</span>}
                  </div>
                  <div className="text-xs text-slate-500">{formatDate(g.date)} · {g.spentBy}{g.paidFrom === "COMPANY_DIRECT" && " · company paid"}{g.lines.length > 1 ? ` · ${g.lines.length} lines` : ""}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold">{formatINR(total)}</div>
                  {allApproved ? <Badge tone="green">APPROVED</Badge> : <Badge tone={TONE[undecided[0].status as keyof typeof TONE]}>{undecided.length < g.lines.length ? `${undecided.length} ${undecided[0].status}` : undecided[0].status}</Badge>}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <PhotoLink url={g.photo} size="h-14 w-14" />
                {!g.photo && g.lines.some((l) => l.entryType === "PURCHASE") && <span className="text-xs font-semibold text-red-600">no bill photo</span>}
              </div>
              <ul className="mt-2 divide-y border-t">
                {g.lines.map((l) => (
                  <li key={l.id} className="py-1.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span>{l.description}</span>
                        <div className="text-xs text-slate-500">{l.category}{l.job ? ` · ${l.job}` : ""}{l.worker ? ` · ${l.worker}` : ""}{l.machine ? ` · ${l.machine}` : ""}{l.problem ? ` · fault: ${l.problem}` : ""}</div>
                        {l.note && <div className="text-xs font-semibold text-blue-700">{l.note}</div>}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-semibold">{formatINR(l.amount)}</div>
                        {g.lines.length > 1 && l.status !== (allApproved ? "APPROVED" : undecided[0].status) && <Badge tone={TONE[l.status as keyof typeof TONE]}>{l.status}</Badge>}
                      </div>
                    </div>
                    {canApprove && g.lines.length > 1 && l.status !== "APPROVED" && (
                      <div className="mt-1 flex gap-1">
                        <button className="rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white" disabled={busy} onClick={() => decide(`/api/expenses/${l.id}/decide`, "APPROVED")}>✓ line</button>
                        <button className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white" disabled={busy} onClick={() => decide(`/api/expenses/${l.id}/decide`, "REJECTED")}>✕ line</button>
                      </div>
                    )}
                    {canApprove && l.status === "APPROVED" && (
                      <button className="mt-1 text-xs font-semibold text-slate-500 underline" disabled={busy} onClick={() => { const reason = window.prompt("Why take back this line's approval? The money goes back to them.") ?? ""; if (reason.trim()) submit(() => api(`/api/expenses/${l.id}/withdraw`, { body: { reason } })); }}>withdraw</button>
                    )}
                    {canDelete && <span className="ml-2 inline-block align-middle"><DeleteButton entity="Expense" id={l.id} what="this line" icon /></span>}
                  </li>
                ))}
              </ul>
              {canApprove && !allApproved && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Button size="sm" variant="success" loading={busy} onClick={() => decide(g.billId ? `/api/bills/${g.billId}/decide` : `/api/expenses/${g.lines[0].id}/decide`, "APPROVED")}>✓ Approve {g.lines.length > 1 ? "bill" : ""}</Button>
                  <Button size="sm" variant="outline" loading={busy} onClick={() => decide(g.billId ? `/api/bills/${g.billId}/decide` : `/api/expenses/${g.lines[0].id}/decide`, "QUERIED")}>? Ask</Button>
                  <Button size="sm" variant="danger" loading={busy} onClick={() => decide(g.billId ? `/api/bills/${g.billId}/decide` : `/api/expenses/${g.lines[0].id}/decide`, "REJECTED")}>✕ Reject</Button>
                </div>
              )}
            </Card>
          );
        })
      )}
      {expenses.length > 0 && <div className="text-right text-sm">Approved in this list: <b>{formatINR(approvedTotal)}</b></div>}
    </div>
  );
}
