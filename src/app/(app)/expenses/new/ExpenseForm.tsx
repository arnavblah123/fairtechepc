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

const ENTRY_TYPES: [string, string, string][] = [
  ["PURCHASE", "Purchase (bill expected)", "खरीद (बिल ज़रूरी)"],
  ["PAYMENT", "Payment to a person (no bill)", "किसी को पैसे दिए (बिल नहीं)"],
  ["OTHER", "Other", "अन्य"],
];

/**
 * The wording on payment source matters more than it looks: the cash a
 * supervisor holds IS company money, so "company paid" reads as the right
 * answer even when they paid from their own pocket. Chosen wrongly the expense
 * is approved but never draws their balance down, and the mistake only surfaces
 * weeks later as a balance that will not reconcile.
 */
const SOURCES: [string, string, string, string][] = [
  ["WORKER_CASH", "I paid, from the cash I am holding", "मैंने अपने पास के कैश से दिया", "Your cash in hand goes down by this amount."],
  ["COMPANY_DIRECT", "Office/bank paid the shop directly", "ऑफिस/बैंक ने सीधे दुकान को दिया", "Your cash in hand does not change."],
];

export function ExpenseForm({ today, inHand, pending, categories, jobs, workers, machines }: {
  today: string; inHand: number; pending: number;
  categories: Category[]; jobs: Opt[]; workers: Opt[]; machines: Opt[];
}) {
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [entryType, setEntryType] = useState("PURCHASE");
  const [paidFrom, setPaidFrom] = useState("WORKER_CASH");
  const [description, setDescription] = useState("");
  const [payeeText, setPayee] = useState("");
  const [jobId, setJobId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [note, setNote] = useState("");
  const [bill, setBill] = useState("");
  const { busy, submit } = useSubmit();

  const category = categories.find((c) => c.id === categoryId);
  const needsBill = entryType === "PURCHASE";
  const safeToSpend = inHand - pending;
  const over = paidFrom === "WORKER_CASH" && Number(amount || 0) > safeToSpend;

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cash in hand</div>
            <div className={`text-xl font-bold ${inHand < 0 ? "text-red-600" : ""}`}>{formatINR(inHand)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Safe to spend</div>
            <div className="text-xl font-bold text-slate-700">{formatINR(safeToSpend)}</div>
          </div>
        </div>
        {pending > 0 && <p className="mt-1 text-center text-xs text-slate-500">{formatINR(pending)} waiting for approval</p>}
      </Card>

      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(
              () =>
                api("/api/expenses", {
                  body: {
                    date, amount: Number(amount), categoryId, entryType, paidFrom, description,
                    payeeText, jobId: jobId || null, workerId: workerId || null,
                    machineId: machineId || null, problem, solution, note, billPhotoUrl: bill,
                  },
                }),
              { to: "/expenses" },
            );
          }}
        >
          <Input label="Amount (₹)" hi="कितने रुपये" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required autoFocus />
          {over && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">This is more than the cash you are holding. Enter it anyway if correct — Arnav will see it.</p>}

          <Select label="Category" hi="किस चीज़ का खर्च" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </Select>

          <div>
            <div className="mb-1 text-sm font-semibold text-slate-700"><Bi en="What kind of spend?" hi="किस तरह का खर्च?" inline /></div>
            <div className="space-y-1.5">
              {ENTRY_TYPES.map(([v, en, hi]) => (
                <button key={v} type="button" onClick={() => setEntryType(v)}
                  className={`flex min-h-[48px] w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ${entryType === v ? "bg-brand text-white" : "bg-slate-100 text-slate-700"}`}>
                  <span className="text-lg">{entryType === v ? "◉" : "○"}</span>
                  <span>{en}<span className="block text-xs font-normal opacity-80">{hi}</span></span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm font-semibold text-slate-700"><Bi en="Whose money paid for it?" hi="पैसा किसने दिया?" inline /></div>
            <div className="space-y-1.5">
              {SOURCES.map(([v, en, hi, effect]) => (
                <button key={v} type="button" onClick={() => setPaidFrom(v)}
                  className={`flex min-h-[56px] w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ${paidFrom === v ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}>
                  <span className="text-lg">{paidFrom === v ? "◉" : "○"}</span>
                  <span>
                    {en}
                    <span className="block text-xs font-normal opacity-80">{hi}</span>
                    <span className="block text-xs font-normal opacity-70">{effect}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Input label="What was it for?" hi="किस लिए?" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={3} placeholder="e.g. 2 bags cement" />
          <Input label="Paid to (shop or person)" hi="किसे दिया" value={payeeText} onChange={(e) => setPayee(e.target.value)} hint="Same name every time keeps that shop's total together." />

          {category?.requiresPerson && (
            <Select label="Which worker?" hi="कौन सा मज़दूर" value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>
              <option value="">Choose…</option>
              {workers.map((w) => (<option key={w.id} value={w.id}>{w.label}</option>))}
            </Select>
          )}

          {category?.requiresMachine && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3">
              <Select label="Which machine?" hi="कौन सी मशीन" value={machineId} onChange={(e) => setMachineId(e.target.value)} required>
                <option value="">Choose…</option>
                {machines.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
              </Select>
              <Input label="What was wrong?" hi="क्या खराबी थी" value={problem} onChange={(e) => setProblem(e.target.value)} required />
              <Input label="What was done?" hi="क्या ठीक किया" value={solution} onChange={(e) => setSolution(e.target.value)} />
              <p className="text-xs text-slate-500">A repair with none of this recorded is just a number — it cannot tell you which machine keeps costing money.</p>
            </div>
          )}

          <Select label="Job (optional)" hi="काम" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">— not job specific —</option>
            {jobs.map((j) => (<option key={j.id} value={j.id}>{j.label}</option>))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" hi="तारीख़" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <CameraInput
            label={needsBill ? "Bill photo (required)" : "Photo (optional)"}
            hi={needsBill ? "बिल फोटो ज़रूरी" : "फोटो"}
            requireGeo={false}
            preview={bill || null}
            onCaptured={(p) => setBill(p.url)}
          />
          <Textarea label="Note (optional)" hi="टिप्पणी" value={note} onChange={(e) => setNote(e.target.value)} />

          <Button type="submit" size="lg" full loading={busy} disabled={needsBill && !bill}>
            <Bi en="Send for approval" hi="मंज़ूरी के लिए भेजें" />
          </Button>
          {needsBill && !bill && <p className="text-center text-xs text-slate-500">A purchase needs a bill photo before it can be sent.</p>}
        </form>
      </Card>
    </div>
  );
}
