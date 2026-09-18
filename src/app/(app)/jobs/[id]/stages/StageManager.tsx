"use client";
import { useState } from "react";
import type { QtyUnit } from "@prisma/client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { STAGE_PRESETS } from "@/lib/validation";

type StageRow = { id: string; sequence: number; name: string; unit: QtyUnit; plannedQty: number; plannedDays: number; hasProgress: boolean };
type Draft = { name: string; unit: QtyUnit; plannedQty: string; plannedDays: string };
const UNITS: QtyUnit[] = ["MT", "NOS", "METRE", "SQM"];
const PRESET_DAYS = [10, 12, 20, 25, 10, 6, 12, 15];

const blank = (): Draft => ({ name: "", unit: "MT", plannedQty: "", plannedDays: "" });

export function StageManager({ jobId, stages, canDelete }: { jobId: string; stages: StageRow[]; canDelete: boolean }) {
  const { busy, submit } = useSubmit();
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>(stages.length === 0 ? PRESET_DRAFTS() : [blank()]);
  const [adding, setAdding] = useState(stages.length === 0);

  const move = (idx: number, dir: -1 | 1) => {
    const order = stages.map((s) => s.id);
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    submit(() => api(`/api/jobs/${jobId}/stages/reorder`, { body: { order } }));
  };

  const patchDraft = (i: number, p: Partial<Draft>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...p } : d)));

  const saveAll = async () => {
    const rows = drafts
      .filter((d) => d.name.trim())
      .map((d) => ({ name: d.name.trim(), unit: d.unit, plannedQty: Number(d.plannedQty || 0), plannedDays: Number(d.plannedDays || 0) }));
    if (!rows.length) return;
    const r = await submit(() => api(`/api/jobs/${jobId}/stages/bulk`, { body: { stages: rows } }));
    if (r) {
      setDrafts([blank()]);
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Only you can add, rename, reorder or delete stages. Supervisors only fill quantity done against them.
      </p>

      {stages.length > 0 && (
        <Card title={`Stages (${stages.length})`} hi="स्टेज">
          <ol className="divide-y">
            {stages.map((s, idx) =>
              editing === s.id ? (
                <li key={s.id} className="py-3">
                  <SingleStageForm
                    initial={s}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSave={async (data) => {
                      const r = await submit(() => api(`/api/stages/${s.id}`, { method: "PATCH", body: data }));
                      if (r) setEditing(null);
                    }}
                  />
                </li>
              ) : (
                <li key={s.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button aria-label="Move up" disabled={idx === 0 || busy} onClick={() => move(idx, -1)} className="h-9 w-9 rounded-lg bg-slate-100 text-lg disabled:opacity-30">▲</button>
                      <button aria-label="Move down" disabled={idx === stages.length - 1 || busy} onClick={() => move(idx, 1)} className="h-9 w-9 rounded-lg bg-slate-100 text-lg disabled:opacity-30">▼</button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{s.sequence}. {s.name}</div>
                      <div className="text-xs text-slate-500">
                        {s.plannedQty} {s.unit} · {s.plannedDays} days
                        {s.hasProgress && " · has progress"}
                      </div>
                    </div>
                    <button onClick={() => setEditing(s.id)} className="min-h-[44px] rounded-lg border-2 border-slate-300 px-3 text-sm font-semibold">Edit</button>
                    {canDelete && <DeleteButton entity="Stage" id={s.id} what={`stage "${s.name}"`} icon />}
                  </div>
                </li>
              ),
            )}
          </ol>
        </Card>
      )}

      {adding ? (
        <Card title="Write all stages" hi="सारी स्टेज एक साथ लिखें">
          <p className="mb-3 text-sm text-slate-600">
            <Bi en="Fill every stage here and save once. Leave a row blank to skip it." hi="सारी स्टेज यहीं भरें और एक बार सेव करें।" />
          </p>
          <div className="space-y-2">
            {drafts.map((d, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-sm font-bold text-slate-400">{stages.length + i + 1}</span>
                  <input
                    className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 p-2 text-base"
                    placeholder="Stage name"
                    list="stage-presets"
                    value={d.name}
                    onChange={(e) => patchDraft(i, { name: e.target.value })}
                  />
                  <button type="button" aria-label="Remove row" className="px-1 font-bold text-red-600" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}>✕</button>
                </div>
                <div className="mt-2 flex gap-2 pl-7 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <span className="w-24">Unit</span>
                  <span className="flex-1">Quantity</span>
                  <span className="flex-1">Days</span>
                </div>
                <div className="mt-0.5 flex gap-2 pl-7">
                  <select className="w-24 rounded-lg border-2 border-slate-300 p-2 text-sm" value={d.unit} onChange={(e) => patchDraft(i, { unit: e.target.value as QtyUnit })} aria-label="Unit">
                    {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
                  </select>
                  <input className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 p-2 text-sm" inputMode="decimal" placeholder="e.g. 120" value={d.plannedQty} onChange={(e) => patchDraft(i, { plannedQty: e.target.value })} aria-label="Planned quantity" />
                  <input className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 p-2 text-sm" inputMode="numeric" placeholder="e.g. 10" value={d.plannedDays} onChange={(e) => patchDraft(i, { plannedDays: e.target.value })} aria-label="Planned days" />
                </div>
              </div>
            ))}
          </div>
          <datalist id="stage-presets">
            {STAGE_PRESETS.map((p) => (<option key={p} value={p} />))}
          </datalist>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => setDrafts([...drafts, blank()])}>+ Add row</Button>
            <Button type="button" variant="outline" onClick={() => setDrafts([...drafts.filter((d) => d.name.trim()), ...PRESET_DRAFTS()])}>Fill standard 8</Button>
          </div>
          <Button size="lg" full className="mt-2" loading={busy} onClick={saveAll}>
            <Bi en={`Save ${drafts.filter((d) => d.name.trim()).length} stages`} hi="सारी स्टेज सेव करें" />
          </Button>
          {stages.length > 0 && (
            <button className="mt-2 w-full text-sm font-semibold text-slate-500" onClick={() => setAdding(false)}>Cancel</button>
          )}
        </Card>
      ) : (
        <Button full variant="outline" onClick={() => { setDrafts([blank()]); setAdding(true); }}>
          + <Bi en="Add more stages" hi="और स्टेज जोड़ें" />
        </Button>
      )}
    </div>
  );
}

function PRESET_DRAFTS(): Draft[] {
  return STAGE_PRESETS.map((name, i) => ({
    name,
    unit: name.startsWith("Blasting") ? "SQM" : "MT",
    plannedQty: "",
    plannedDays: String(PRESET_DAYS[i] ?? 10),
  }));
}

function SingleStageForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: { name: string; unit: QtyUnit; plannedQty: number; plannedDays: number };
  busy: boolean;
  onSave: (d: { name: string; unit: QtyUnit; plannedQty: number; plannedDays: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [unit, setUnit] = useState<QtyUnit>(initial.unit);
  const [qty, setQty] = useState(String(initial.plannedQty));
  const [days, setDays] = useState(String(initial.plannedDays));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, unit, plannedQty: Number(qty), plannedDays: Number(days) });
      }}
    >
      <Input label="Stage name" hi="स्टेज नाम" value={name} onChange={(e) => setName(e.target.value)} required list="stage-presets" />
      <div className="grid grid-cols-3 gap-2">
        <Select label="Unit" hi="इकाई" value={unit} onChange={(e) => setUnit(e.target.value as QtyUnit)}>
          {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
        </Select>
        <Input label="Planned qty" hi="मात्रा" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" required />
        <Input label="Planned days" hi="दिन" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" required />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1" loading={busy}><Bi en="Save" hi="सेव" /></Button>
      </div>
    </form>
  );
}
