"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";

type Item = { id: string; name: string; unit: string; onHand: number };
type Job = { id: string; label: string; stages: { id: string; name: string }[] };

export function ConsumeForm({ date, items, jobs, todays }: { date: string; items: Item[]; jobs: Job[]; todays: string[] }) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [stageId, setStageId] = useState("");
  const [qty, setQty] = useState("");
  const { busy, submit } = useSubmit();
  const item = items.find((i) => i.id === itemId);
  const job = jobs.find((j) => j.id === jobId);
  if (jobs.length === 0) return <Card><p className="text-sm text-slate-500">No active jobs.</p></Card>;
  return (
    <div className="space-y-4">
      <Card>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await submit(() => api("/api/consumables/consume", { body: { itemId, jobId, stageId: stageId || null, date, qty: Number(qty) } }));
            if (r) setQty("");
          }}
        >
          <Select label="Item" hi="सामान" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {items.map((i) => (<option key={i.id} value={i.id}>{i.name} (stock: {i.onHand} {i.unit})</option>))}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select label="Job" hi="काम" value={jobId} onChange={(e) => { setJobId(e.target.value); setStageId(""); }}>
              {jobs.map((j) => (<option key={j.id} value={j.id}>{j.label}</option>))}
            </Select>
            <Select label="Stage (optional)" hi="स्टेज" value={stageId} onChange={(e) => setStageId(e.target.value)}>
              <option value="">—</option>
              {job?.stages.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </Select>
          </div>
          <Input label={`Quantity used today${item ? ` (${item.unit})` : ""}`} hi="आज कितना लगा" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" required />
          <Button type="submit" size="lg" full loading={busy}>
            <Bi en="Save consumption" hi="खपत सेव करें" />
          </Button>
        </form>
      </Card>
      <Card title="Entered today" hi="आज की एंट्री">
        {todays.length === 0 ? <p className="text-sm text-slate-500">Nothing yet.</p> : (
          <ul className="list-disc pl-5 text-sm">{todays.map((t, i) => (<li key={i}>{t}</li>))}</ul>
        )}
      </Card>
    </div>
  );
}
