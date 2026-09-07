"use client";
import { useState } from "react";
import type { ExpenseCategory, PettyTxnType, Urgency } from "@prisma/client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card, Stat } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { CameraInput } from "@/components/forms/CameraInput";
import { PhotoLink } from "@/components/forms/PhotoLink";
import { ExportLink } from "@/components/forms/ExportLink";
import { formatDate, formatINR, titleCase } from "@/lib/format";

type Req = { id: string; amount: number; reason: string; urgency: Urgency; status: string; by: string; mode: string | null; note: string | null };
type Txn = { id: string; date: string; type: PettyTxnType; amount: number; category: ExpenseCategory | null; description: string; paidTo: string | null; bill: string | null; by: string };
const CATEGORIES: [ExpenseCategory, string, string][] = [
  ["LABOUR_FOOD", "Labour food", "मज़दूर खाना"],
  ["LOCAL_TRANSPORT", "Local transport", "लोकल ट्रांसपोर्ट"],
  ["SMALL_PURCHASE", "Small purchase", "छोटी खरीद"],
  ["HARDWARE", "Hardware", "हार्डवेयर"],
  ["MEDICAL", "Medical", "मेडिकल"],
  ["MISC", "Misc", "अन्य"],
];

export function PettyBoard(props: {
  siteId: string; today: string; full: boolean; canApprove: boolean; canExpense: boolean; canRequest: boolean;
  balance: number; burnRate: number; threshold: number;
  requests: Req[]; txns: Txn[]; recons: { month: string; physical: number; app: number; note: string | null }[];
}) {
  const { siteId, full, canApprove, canExpense, canRequest } = props;
  const { busy, submit } = useSubmit();
  const [mode, setMode] = useState<"none" | "request" | "expense" | "reconcile">("none");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("NORMAL");
  const [category, setCategory] = useState<ExpenseCategory>("LABOUR_FOOD");
  const [paidTo, setPaidTo] = useState("");
  const [bill, setBill] = useState("");
  const [physical, setPhysical] = useState("");

  const reset = () => { setMode("none"); setAmount(""); setReason(""); setPaidTo(""); setBill(""); setPhysical(""); };

  return (
    <div>
      <PageHeader title="Petty cash" hi="पेटी कैश" back="/more" action={canApprove ? <ExportLink href={`/api/petty/export?siteId=${siteId}`} /> : undefined} />
      {full && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Stat label="Wallet balance" hi="बैलेंस" value={formatINR(props.balance)} tone={props.balance < props.threshold ? "red" : "green"} />
          <Stat label="Burn / day (30d)" hi="रोज़ खर्च" value={formatINR(Math.round(props.burnRate))} />
        </div>
      )}
      {full && props.balance < props.threshold && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">⚠ Balance below alert threshold {formatINR(props.threshold)}</p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2">
        {canRequest && <Button variant="primary" onClick={() => setMode(mode === "request" ? "none" : "request")}><Bi en="Request cash" hi="कैश माँगें" /></Button>}
        {canExpense && <Button variant="secondary" onClick={() => setMode(mode === "expense" ? "none" : "expense")}><Bi en="Add expense" hi="खर्च भरें" /></Button>}
        {canExpense && <Button variant="outline" className="col-span-2" onClick={() => setMode(mode === "reconcile" ? "none" : "reconcile")}><Bi en="Monthly cash count (reconcile)" hi="महीने की गिनती" /></Button>}
      </div>

      {mode === "request" && (
        <Card title="Request cash" hi="कैश रिक्वेस्ट" className="mb-4">
          <div className="space-y-3">
            <Input label="Amount (₹)" hi="राशि" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" required />
            <Textarea label="Reason" hi="कारण" value={reason} onChange={(e) => setReason(e.target.value)} required />
            <Select label="Urgency" hi="कितनी जल्दी" value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
              <option value="NORMAL">Normal</option><option value="URGENT">Urgent</option><option value="WORK_STOPPED">Work stopped!</option>
            </Select>
            <Button full loading={busy} onClick={async () => { const r = await submit(() => api(`/api/petty/requests?siteId=${siteId}`, { body: { amount: Number(amount), reason, urgency } })); if (r) reset(); }}>
              Send request
            </Button>
          </div>
        </Card>
      )}
      {mode === "expense" && (
        <Card title="New expense" hi="नया खर्च" className="mb-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input label="Amount (₹)" hi="राशि" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" required />
              <Select label="Category" hi="प्रकार" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                {CATEGORIES.map(([v, en, hi]) => (<option key={v} value={v}>{en} / {hi}</option>))}
              </Select>
            </div>
            <Input label="Paid to" hi="किसे दिया" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} />
            <Textarea label="What for?" hi="किस लिए?" value={reason} onChange={(e) => setReason(e.target.value)} required />
            <CameraInput label="Bill photo (required)" hi="बिल फोटो ज़रूरी" requireGeo={false} preview={bill || null} onCaptured={(p) => setBill(p.url)} />
            <Button full loading={busy} disabled={!bill} onClick={async () => {
              const r = await submit(() => api(`/api/petty/expenses?siteId=${siteId}`, { body: { date: props.today, amount: Number(amount), category, description: reason, paidTo, billPhotoUrl: bill } }));
              if (r) reset();
            }}>
              Save expense
            </Button>
          </div>
        </Card>
      )}
      {mode === "reconcile" && (
        <Card title="Monthly cash count" hi="कैश गिनती" className="mb-4">
          <div className="space-y-3">
            <Input label="Physical cash in hand (₹)" hi="हाथ में कैश" value={physical} onChange={(e) => setPhysical(e.target.value)} inputMode="numeric" required />
            <Button full loading={busy} onClick={async () => {
              const r = await submit(() => api(`/api/petty/reconcile?siteId=${siteId}`, { body: { month: props.today.slice(0, 8) + "01", physicalCash: Number(physical) } }));
              if (r) reset();
            }}>
              Save count
            </Button>
          </div>
        </Card>
      )}

      <Card title="Cash requests" hi="कैश रिक्वेस्ट" className="mb-4">
        <ul className="divide-y">
          {props.requests.map((r) => (
            <li key={r.id} className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{formatINR(r.amount)}</span>
                <Badge tone={r.status === "SENT" ? "green" : r.status === "APPROVED" ? "blue" : r.status === "REJECTED" ? "red" : "amber"}>
                  {r.status}{r.mode ? ` · ${r.mode}` : ""}
                </Badge>
              </div>
              <div className="text-xs text-slate-500">{r.reason} · {r.by}{r.urgency !== "NORMAL" ? ` · ${titleCase(r.urgency)}` : ""}{r.note ? ` · ${r.note}` : ""}</div>
              {canApprove && r.status === "PENDING" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="success" loading={busy} onClick={() => submit(() => api(`/api/petty/requests/${r.id}/decide`, { body: { decision: "APPROVED" } }))}>✓ Approve</Button>
                  <Button size="sm" variant="danger" loading={busy} onClick={() => {
                    const note = window.prompt("Reason for rejection?") ?? "";
                    if (note.trim()) submit(() => api(`/api/petty/requests/${r.id}/decide`, { body: { decision: "REJECTED", note } }));
                  }}>✕ Reject</Button>
                </div>
              )}
              {canApprove && r.status === "APPROVED" && (
                <div className="mt-2 flex gap-2">
                  {(["UPI", "BANK", "CASH"] as const).map((m) => (
                    <Button key={m} size="sm" variant="secondary" loading={busy} onClick={() => submit(() => api(`/api/petty/requests/${r.id}/sent`, { body: { mode: m } }))}>
                      Sent via {m}
                    </Button>
                  ))}
                </div>
              )}
            </li>
          ))}
          {props.requests.length === 0 && <li className="py-3 text-sm text-slate-500">No requests.</li>}
        </ul>
      </Card>

      {full && (
        <>
          <Card title="Recent transactions" hi="लेन-देन" className="mb-4">
            <ul className="divide-y text-sm">
              {props.txns.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate">{t.description}</div>
                    <div className="text-xs text-slate-500">{formatDate(t.date)}{t.category ? ` · ${titleCase(t.category)}` : ""}{t.paidTo ? ` · ${t.paidTo}` : ""} · {t.by}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PhotoLink url={t.bill} size="h-10 w-10" />
                    <b className={t.type === "EXPENSE" ? "text-red-600" : "text-green-700"}>{t.type === "EXPENSE" ? "−" : "+"}{formatINR(t.amount)}</b>
                  </div>
                </li>
              ))}
              {props.txns.length === 0 && <li className="py-3 text-sm text-slate-500">No transactions yet.</li>}
            </ul>
          </Card>
          {props.recons.length > 0 && (
            <Card title="Reconciliation" hi="मिलान">
              <ul className="divide-y text-sm">
                {props.recons.map((r) => {
                  const diff = r.physical - r.app;
                  return (
                    <li key={r.month} className="flex items-center justify-between py-2">
                      <span>{formatDate(r.month).slice(3)}</span>
                      <span>counted {formatINR(r.physical)} vs app {formatINR(r.app)}</span>
                      {Math.abs(diff) < 1 ? <Badge tone="green">OK</Badge> : <Badge tone="red">{diff > 0 ? "+" : ""}{formatINR(diff)}</Badge>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
