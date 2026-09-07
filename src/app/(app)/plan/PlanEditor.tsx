"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";

type Job = { id: string; label: string; stages: { id: string; name: string; unit: string }[] };
type Item = { jobId: string; stageId: string; targetQty: string; manpowerPlanned: string; note: string };

export function PlanEditor({
  siteId,
  date,
  jobs,
  existing,
  canSubmit,
}: {
  siteId: string;
  date: string;
  jobs: Job[];
  existing: { remark: string; submittedBy: string; items: Item[] } | null;
  canSubmit: boolean;
}) {
  const [items, setItems] = useState<Item[]>(existing?.items ?? []);
  const [remark, setRemark] = useState(existing?.remark ?? "");
  const { busy, submit } = useSubmit();

  const addRow = () => {
    const job = jobs[0];
    if (!job) return;
    setItems([...items, { jobId: job.id, stageId: job.stages[0]?.id ?? "", targetQty: "", manpowerPlanned: "", note: "" }]);
  };
  const patch = (idx: number, p: Partial<Item>) => setItems(items.map((it, i) => (i === idx ? { ...it, ...p } : it)));

  if (jobs.length === 0) return <Card><p className="text-sm text-slate-500">No active jobs. Ask Arnav to create one.</p></Card>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-3 text-sm shadow-sm">
        <b>{formatDate(date)}</b> — <Bi en="What will be done today?" hi="आज क्या होगा?" inline />
        {existing && <span className="ml-1 text-slate-500">(submitted by {existing.submittedBy}; saving again replaces it)</span>}
      </div>
      {items.map((it, idx) => {
        const job = jobs.find((j) => j.id === it.jobId) ?? jobs[0];
        const stage = job.stages.find((s) => s.id === it.stageId);
        return (
          <Card key={idx}>
            <div className="space-y-3">
              <Select label="Job" hi="काम" value={it.jobId} onChange={(e) => {
                const j = jobs.find((x) => x.id === e.target.value)!;
                patch(idx, { jobId: j.id, stageId: j.stages[0]?.id ?? "" });
              }}>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.label}</option>
                ))}
              </Select>
              <Select label="Stage" hi="स्टेज" value={it.stageId} onChange={(e) => patch(idx, { stageId: e.target.value })}>
                {job.stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input label={`Target qty${stage ? ` (${stage.unit})` : ""}`} hi="लक्ष्य" value={it.targetQty} onChange={(e) => patch(idx, { targetQty: e.target.value })} inputMode="decimal" required />
                <Input label="Manpower" hi="मज़दूर" value={it.manpowerPlanned} onChange={(e) => patch(idx, { manpowerPlanned: e.target.value })} inputMode="numeric" required />
              </div>
              <Input label="Note (optional)" hi="नोट" value={it.note} onChange={(e) => patch(idx, { note: e.target.value })} />
              <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-sm font-semibold text-red-600">
                Remove line
              </button>
            </div>
          </Card>
        );
      })}
      <Button variant="outline" full onClick={addRow}>
        + <Bi en="Add line" hi="लाइन जोड़ें" />
      </Button>
      <Textarea label="Remark" hi="टिप्पणी" value={remark} onChange={(e) => setRemark(e.target.value)} />
      {canSubmit && (
        <Button
          size="lg"
          full
          loading={busy}
          disabled={items.length === 0}
          onClick={() =>
            submit(() =>
              api(`/api/plan?siteId=${siteId}`, {
                body: { date, remark, items: items.map((i) => ({ ...i, targetQty: Number(i.targetQty), manpowerPlanned: Number(i.manpowerPlanned) })) },
              }),
            )
          }
        >
          <Bi en={existing ? "Update today's plan" : "Submit today's plan"} hi={existing ? "योजना अपडेट करें" : "योजना सबमिट करें"} />
        </Button>
      )}
    </div>
  );
}
