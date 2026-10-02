"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { CameraInput } from "@/components/forms/CameraInput";
import { formatINR } from "@/lib/format";

type Category = { id: string; name: string; requiresPerson: boolean; requiresMachine: boolean };
type Opt = { id: string; label: string };
type Line = { categoryId: string; description: string; amount: string; jobId: string; workerId: string; machineId: string; problem: string; solution: string };

/**
 * The wording on payment source matters more than it looks: the cash a
 * supervisor holds IS company money, so "company paid" reads as the right
 * answer even when they paid from their own pocket. Chosen wrongly the bill is
 * approved but never draws their balance down.
 */
const SOURCES: [string, string, string, string][] = [
  ["WORKER_CASH", "I paid, from the cash I am holding", "मैंने अपने पास के कैश से दिया", "Your cash in hand goes down by this bill."],
  ["COMPANY_DIRECT", "Office/bank paid the shop directly", "ऑफिस/बैंक ने सीधे दुकान को दिया", "Your cash in hand does not change."],
];

/** One bill, one payee, one photo, as many lines as are on it. */
export function BillForm({ today, inHand, pending, categories, jobs, workers, machines, vendors }: {
  today: string; inHand: number; pending: number; categories: Category[]; jobs: Opt[]; workers: Opt[]; machines: Opt[]; vendors: string[];
}) {
  const blank = (): Line => ({ categoryId: categories[0]?.id ?? "", description: "", amount: "", jobId: "", workerId: "", machineId: "", problem: "", solution: "" });
  const [date, setDate] = useState(today);
  const [payeeText, setPayee] = useState("");
  const [billNo, setBillNo] = useState("");
  const [paidFrom, setPaidFrom] = useState("WORKER_CASH");
  const [bill, setBill] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const { busy, submit } = useSubmit();

  const total = lines.reduce((a, l) => a + Number(l.amount || 0), 0);
  const safeToSpend = inHand - pending;
  const over = paidFrom === "WORKER_CASH" && total > safeToSpend;
  const patch = (i: number, p: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const ready = lines.filter((l) => l.description.trim() && Number(l.amount) > 0);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cash in hand</div><div className={`text-xl font-bold ${inHand < 0 ? "text-red-600" : ""}`}>{formatINR(inHand)}</div></div>
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Safe to spend</div><div className="text-xl font-bold text-slate-700">{formatINR(safeToSpend)}</div></div>
        </div>
        {pending > 0 && <p className="mt-1 text-center text-xs text-slate-500">{formatINR(pending)} waiting for approval</p>}
      </Card>

      <Card>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          submit(() => api("/api/bills", { body: { date, payeeText, billNo, paidFrom, billPhotoUrl: bill, note, lines: ready.map((l) => ({ ...l, amount: Number(l.amount), jobId: l.jobId || null, workerId: l.workerId || null, machineId: l.machineId || null })) } }), { to: "/expenses" });
        }}>
          <Input label="Paid to (shop or person)" hi="किसे दिया" value={payeeText} onChange={(e) => setPayee(e.target.value)} required list="vendor-names" autoFocus hint="Same name every time keeps that shop's ledger together." />
          <datalist id="vendor-names">{vendors.map((v) => (<option key={v} value={v} />))}</datalist>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" hi="तारीख़" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input label="Bill no (optional)" hi="बिल नंबर" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
          </div>

          <div>
            <div className="mb-1 text-sm font-semibold text-slate-700"><Bi en="Whose money paid for it?" hi="पैसा किसने दिया?" inline /></div>
            <div className="space-y-1.5">
              {SOURCES.map(([v, en, hi, effect]) => (
                <button key={v} type="button" onClick={() => setPaidFrom(v)} className={`flex min-h-[56px] w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ${paidFrom === v ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}>
                  <span className="text-lg">{paidFrom === v ? "◉" : "○"}</span>
                  <span>{en}<span className="block text-xs font-normal opacity-80">{hi}</span><span className="block text-xs font-normal opacity-70">{effect}</span></span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-700"><Bi en="What is on the bill" hi="बिल में क्या-क्या है" inline /></span>
              <span className="text-sm font-bold">{formatINR(total)}</span>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => {
                const cat = categories.find((c) => c.id === l.categoryId);
                return (
                  <div key={i} className="rounded-xl border border-slate-200 p-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                      <input className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 p-2 text-base" placeholder="What was it? e.g. 6 bags cement" value={l.description} onChange={(e) => patch(i, { description: e.target.value })} aria-label="Line description" />
                      <input className="w-24 rounded-lg border-2 border-slate-300 p-2 text-base" inputMode="decimal" placeholder="₹" value={l.amount} onChange={(e) => patch(i, { amount: e.target.value })} aria-label="Line amount" />
                      <button type="button" className="px-1 font-bold text-red-600" aria-label="Remove line" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : [blank()])}>✕</button>
                    </div>
                    <div className="mt-2 flex gap-2 pl-7">
                      <select className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 p-2 text-sm" value={l.categoryId} onChange={(e) => patch(i, { categoryId: e.target.value })} aria-label="Category">
                        {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                      <select className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 p-2 text-sm" value={l.jobId} onChange={(e) => patch(i, { jobId: e.target.value })} aria-label="Job">
                        <option value="">— job —</option>
                        {jobs.map((j) => (<option key={j.id} value={j.id}>{j.label}</option>))}
                      </select>
                    </div>
                    {cat?.requiresPerson && (
                      <div className="mt-2 pl-7">
                        <select className="w-full rounded-lg border-2 border-slate-300 p-2 text-sm" value={l.workerId} onChange={(e) => patch(i, { workerId: e.target.value })} aria-label="Worker" required>
                          <option value="">Which worker?</option>
                          {workers.map((w) => (<option key={w.id} value={w.id}>{w.label}</option>))}
                        </select>
                      </div>
                    )}
                    {cat?.requiresMachine && (
                      <div className="mt-2 space-y-2 pl-7">
                        <select className="w-full rounded-lg border-2 border-slate-300 p-2 text-sm" value={l.machineId} onChange={(e) => patch(i, { machineId: e.target.value })} aria-label="Machine" required>
                          <option value="">Which machine?</option>
                          {machines.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
                        </select>
                        <input className="w-full rounded-lg border-2 border-slate-300 p-2 text-sm" placeholder="What was wrong?" value={l.problem} onChange={(e) => patch(i, { problem: e.target.value })} required />
                        <input className="w-full rounded-lg border-2 border-slate-300 p-2 text-sm" placeholder="What was done?" value={l.solution} onChange={(e) => patch(i, { solution: e.target.value })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="outline" full size="sm" className="mt-2" onClick={() => setLines([...lines, blank()])}>+ <Bi en="Add another line" hi="एक और लाइन" inline /></Button>
          </div>
          {over && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">This bill is more than the cash you are holding. Send it anyway if correct — Arnav will see it.</p>}

          <CameraInput label="Bill photo" hi="बिल फोटो" requireGeo={false} preview={bill || null} onCaptured={(p) => setBill(p.url)} />
          <p className="-mt-2 text-xs text-slate-500"><Bi en="A shop bill must have its photo. Paying a person (labour, tempo, tea) has no bill — leave it empty." hi="दुकान के बिल की फोटो ज़रूरी। किसी व्यक्ति को दिया पैसा — बिना फोटो ठीक है।" /></p>
          <Textarea label="Note (optional)" hi="टिप्पणी" value={note} onChange={(e) => setNote(e.target.value)} />

          <Button type="submit" size="lg" full loading={busy} disabled={ready.length === 0 || payeeText.trim().length < 2}>
            <Bi en={`Send ${formatINR(total)} for approval`} hi="मंज़ूरी के लिए भेजें" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
