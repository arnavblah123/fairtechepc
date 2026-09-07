"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatINR } from "@/lib/format";

type Adv = { id: string; worker: string; amount: number; reason: string; status: string; by: string; deducted: boolean; note: string | null };

export function AdvancesBoard({ canRequest, canApprove, showAmounts, workers, advances }: {
  canRequest: boolean; canApprove: boolean; showAmounts: boolean;
  workers: { id: string; code: string; name: string }[]; advances: Adv[];
}) {
  const [show, setShow] = useState(false);
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { busy, submit } = useSubmit();
  return (
    <div>
      <PageHeader title="Worker advances" hi="मज़दूर एडवांस" back="/more" />
      {canRequest && (show ? (
        <Card title="Request advance" hi="एडवांस रिक्वेस्ट" className="mb-4">
          <div className="space-y-3">
            <Select label="Worker" hi="मज़दूर" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              {workers.map((w) => (<option key={w.id} value={w.id}>{w.code} · {w.name}</option>))}
            </Select>
            <Input label="Amount (₹)" hi="राशि" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" required />
            <Textarea label="Reason" hi="कारण" value={reason} onChange={(e) => setReason(e.target.value)} required />
            <Button full loading={busy} onClick={async () => {
              const r = await submit(() => api("/api/advances", { body: { workerId, amount: Number(amount), reason } }));
              if (r) { setShow(false); setAmount(""); setReason(""); }
            }}>
              Send request
            </Button>
          </div>
        </Card>
      ) : (
        <Button full size="lg" className="mb-4" onClick={() => setShow(true)}>+ <Bi en="Request advance" hi="एडवांस माँगें" /></Button>
      ))}
      <Card>
        <ul className="divide-y">
          {advances.map((a) => (
            <li key={a.id} className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{a.worker}{showAmounts && <> · {formatINR(a.amount)}</>}</span>
                <Badge tone={a.status === "APPROVED" ? "green" : a.status === "REJECTED" ? "red" : "amber"}>
                  {a.status}{a.deducted ? " · deducted" : ""}
                </Badge>
              </div>
              <div className="text-xs text-slate-500">{a.reason} · by {a.by}{a.note ? ` · ${a.note}` : ""}</div>
              {canApprove && a.status === "PENDING" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="success" loading={busy} onClick={() => submit(() => api(`/api/advances/${a.id}/decide`, { body: { decision: "APPROVED" } }))}>✓ Approve</Button>
                  <Button size="sm" variant="danger" loading={busy} onClick={() => {
                    const note = window.prompt("Reason for rejection?") ?? "";
                    if (note.trim()) submit(() => api(`/api/advances/${a.id}/decide`, { body: { decision: "REJECTED", note } }));
                  }}>✕ Reject</Button>
                </div>
              )}
            </li>
          ))}
          {advances.length === 0 && <li className="py-3 text-sm text-slate-500">No advances.</li>}
        </ul>
      </Card>
    </div>
  );
}
