"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card, Stat } from "@/components/ui/Card";
import { formatINR, titleCase } from "@/lib/format";

type Bal = { holderId: string; name: string; role: string; advanced: number; spent: number; returned: number; inHand: number; needsReconcile: boolean };
type Row = { id: string; holder: string; kind: string; amount: number; memo: string; at: string; isReversal: boolean };

const KINDS: [string, string][] = [
  ["ADVANCE", "Give cash"],
  ["RETURN", "Cash returned to office"],
  ["ADJUSTMENT", "Correction"],
];

export function CashBoard({ siteId, onStreet, walletBalance, balances, people, recent }: {
  siteId: string; onStreet: number; walletBalance: number;
  balances: Bal[]; people: { id: string; name: string; role: string }[]; recent: Row[];
}) {
  const [open, setOpen] = useState(false);
  const [holderId, setHolder] = useState(people[0]?.id ?? "");
  const [kind, setKind] = useState("ADVANCE");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const { busy, submit } = useSubmit();
  // The site cash book and the per-person ledgers describe the same money.
  const drift = Math.round((walletBalance - onStreet) * 100) / 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Cash with people" hi="लोगों के पास" value={formatINR(onStreet)} tone={onStreet < 0 ? "red" : "blue"} />
        <Stat label="Site cash book" hi="साइट बही" value={formatINR(walletBalance)} />
      </div>
      {Math.abs(drift) >= 1 && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          ⚠ The cash book and the per-person ledgers differ by {formatINR(Math.abs(drift))}. Post a correction against whoever it belongs to.
        </p>
      )}

      {open ? (
        <Card title="Move cash" hi="कैश दें या वापस लें">
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            const r = await submit(() => api(`/api/cash/move?siteId=${siteId}`, { body: { holderId, kind, amount: Number(amount), memo } }));
            if (r) { setOpen(false); setAmount(""); setMemo(""); }
          }}>
            <Select label="Person" hi="किसके पास" value={holderId} onChange={(e) => setHolder(e.target.value)}>
              {people.map((p) => (<option key={p.id} value={p.id}>{p.name} — {titleCase(p.role)}</option>))}
            </Select>
            <Select label="What is happening?" hi="क्या कर रहे हैं" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
            </Select>
            <Input label="Amount (₹)" hi="राशि" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required
              hint={kind === "ADJUSTMENT" ? "Use a minus sign to reduce their balance." : undefined} />
            <Input label="Note" hi="टिप्पणी" value={memo} onChange={(e) => setMemo(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" loading={busy}>Save</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Button full size="lg" onClick={() => setOpen(true)}>+ <Bi en="Give or take back cash" hi="कैश दें / वापस लें" /></Button>
      )}

      <Card title="Who is holding what" hi="किसके पास कितना">
        {balances.length === 0 ? (
          <p className="text-sm text-slate-500">Nobody has been given cash yet.</p>
        ) : (
          <ul className="divide-y">
            {balances.map((b) => (
              <li key={b.holderId} className="py-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{b.name}</span>
                  <span className={`text-lg font-bold ${b.needsReconcile ? "text-red-600" : ""}`}>{formatINR(b.inHand)}</span>
                </div>
                <div className="text-xs text-slate-500">
                  given {formatINR(b.advanced)} · spent {formatINR(b.spent)}
                  {b.returned > 0 && ` · returned ${formatINR(b.returned)}`}
                </div>
                {b.needsReconcile && <Badge tone="red">Negative — something is recorded wrong</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Recent cash movements" hi="हाल की एंट्री">
        <ul className="divide-y text-sm">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className="truncate">
                  <b>{r.holder}</b> · {titleCase(r.kind)}
                  {r.isReversal && <span className="ml-1 text-xs font-semibold text-amber-700">(reversal)</span>}
                </div>
                <div className="text-xs text-slate-500">{r.memo || "—"} · {r.at}</div>
              </div>
              <b className={r.amount < 0 ? "text-red-600" : "text-green-700"}>{r.amount < 0 ? "−" : "+"}{formatINR(Math.abs(r.amount))}</b>
            </li>
          ))}
          {recent.length === 0 && <li className="py-2 text-slate-500">No movements yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
