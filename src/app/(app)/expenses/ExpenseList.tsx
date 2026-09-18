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
  id: string; date: string; amount: number; category: string; description: string;
  entryType: string; paidFrom: string; payee: string | null; status: string; spentBy: string;
  job: string | null; worker: string | null; machine: string | null; problem: string | null;
  bill: string | null; note: string | null;
};
const TONE = { PENDING: "amber", APPROVED: "green", QUERIED: "blue", REJECTED: "red" } as const;
const TABS: [string | null, string][] = [[null, "All"], ["PENDING", "Waiting"], ["APPROVED", "Approved"], ["QUERIED", "Query"], ["REJECTED", "Rejected"]];

export function ExpenseList({
  expenses, canCreate, canApprove, canDelete, showOwnCash, inHand, pending, activeStatus,
}: {
  expenses: Expense[]; canCreate: boolean; canApprove: boolean; canDelete: boolean;
  showOwnCash: boolean; inHand: number; pending: number; activeStatus: string | null;
}) {
  const { busy, submit } = useSubmit();
  const total = expenses.filter((e) => e.status === "APPROVED").reduce((a, e) => a + e.amount, 0);

  const decide = (id: string, decision: "APPROVED" | "REJECTED" | "QUERIED") => {
    if (decision === "APPROVED") return submit(() => api(`/api/expenses/${id}/decide`, { body: { decision } }));
    const note = window.prompt(decision === "QUERIED" ? "What do you want explained?" : "Why is it rejected?") ?? "";
    if (note.trim()) submit(() => api(`/api/expenses/${id}/decide`, { body: { decision, note } }));
  };

  return (
    <div className="space-y-4">
      {showOwnCash && (
        <Card>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">My cash in hand</div>
              <div className={`text-xl font-bold ${inHand < 0 ? "text-red-600" : ""}`}>{formatINR(inHand)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Waiting approval</div>
              <div className="text-xl font-bold text-amber-600">{formatINR(pending)}</div>
            </div>
          </div>
        </Card>
      )}

      {canCreate && (
        <Link href="/expenses/new" className="flex min-h-[56px] items-center justify-center rounded-xl bg-brand text-lg font-semibold text-white">
          + <Bi en="Add expense" hi="खर्च भरें" />
        </Link>
      )}

      <div className="flex flex-wrap gap-1.5 text-sm font-semibold">
        {TABS.map(([v, label]) => (
          <Link key={label} href={v ? `/expenses?status=${v}` : "/expenses"} className={`rounded-full px-3 py-1.5 ${activeStatus === v ? "bg-brand text-white" : "bg-white"}`}>
            {label}
          </Link>
        ))}
      </div>

      <Card>
        {expenses.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Nothing here yet.</p>
        ) : (
          <>
            <ul className="divide-y">
              {expenses.map((e) => (
                <li key={e.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{e.description}</div>
                      <div className="text-xs text-slate-500">
                        {e.category}{e.payee ? ` · ${e.payee}` : ""}{e.worker ? ` · ${e.worker}` : ""}{e.machine ? ` · ${e.machine}` : ""}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(e.date)} · {e.spentBy}
                        {e.job ? ` · ${e.job}` : ""}
                        {e.paidFrom === "COMPANY_DIRECT" && " · company paid"}
                      </div>
                      {e.problem && <div className="text-xs text-slate-500">Fault: {e.problem}</div>}
                      {e.note && <div className="text-xs font-semibold text-blue-700">{e.note}</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-bold">{formatINR(e.amount)}</div>
                      <Badge tone={TONE[e.status as keyof typeof TONE]}>{e.status}</Badge>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <PhotoLink url={e.bill} size="h-12 w-12" />
                    {e.entryType === "PURCHASE" && !e.bill && <span className="text-xs font-semibold text-red-600">no bill</span>}
                  </div>
                  {canApprove && e.status !== "APPROVED" && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Button size="sm" variant="success" loading={busy} onClick={() => decide(e.id, "APPROVED")}>✓ Approve</Button>
                      <Button size="sm" variant="outline" loading={busy} onClick={() => decide(e.id, "QUERIED")}>? Ask</Button>
                      <Button size="sm" variant="danger" loading={busy} onClick={() => decide(e.id, "REJECTED")}>✕ Reject</Button>
                    </div>
                  )}
                  {canApprove && e.status === "APPROVED" && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" loading={busy} onClick={() => {
                        const reason = window.prompt("Why are you taking the approval back? The money goes back to them.") ?? "";
                        if (reason.trim()) submit(() => api(`/api/expenses/${e.id}/withdraw`, { body: { reason } }));
                      }}>
                        Withdraw approval
                      </Button>
                      {canDelete && <DeleteButton entity="Expense" id={e.id} what="this expense" icon />}
                    </div>
                  )}
                  {canDelete && e.status !== "APPROVED" && (
                    <div className="mt-2"><DeleteButton entity="Expense" id={e.id} what="this expense" icon /></div>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t pt-2 text-right text-sm">
              Approved in this list: <b>{formatINR(total)}</b>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
