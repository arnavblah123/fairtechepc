"use client";
import { useState } from "react";
import type { QtyUnit } from "@prisma/client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { STAGE_PRESETS } from "@/lib/validation";

type StageRow = { id: string; sequence: number; name: string; unit: QtyUnit; plannedQty: number; plannedDays: number; hasProgress: boolean };
const UNITS: QtyUnit[] = ["MT", "NOS", "METRE", "SQM"];

export function StageManager({ jobId, stages, plannedTonnage }: { jobId: string; stages: StageRow[]; plannedTonnage: number }) {
  const { busy, submit } = useSubmit();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(stages.length === 0);

  const move = (idx: number, dir: -1 | 1) => {
    const order = stages.map((s) => s.id);
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    submit(() => api(`/api/jobs/${jobId}/stages/reorder`, { body: { order } }));
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Only you can add, rename or reorder stages. Supervisors only fill progress against them.
      </p>

      {stages.length === 0 && (
        <Button
          full
          size="lg"
          variant="secondary"
          loading={busy}
          onClick={() =>
            submit(() =>
              api(`/api/jobs/${jobId}/stages`, {
                body: {
                  stages: STAGE_PRESETS.map((name, i) => ({
                    name,
                    unit: name.startsWith("Blasting") ? "SQM" : "MT",
                    plannedQty: name.startsWith("Blasting") ? Math.round(plannedTonnage * 20) || 1 : plannedTonnage || 1,
                    plannedDays: [10, 12, 20, 25, 10, 6, 12, 15][i],
                  })),
                },
              }),
            )
          }
        >
          <Bi en="Add standard 8 stages" hi="8 मानक स्टेज जोड़ें" />
        </Button>
      )}

      <Card>
        <ol className="divide-y">
          {stages.map((s, idx) =>
            editing === s.id ? (
              <li key={s.id} className="py-3">
                <StageForm
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
              <li key={s.id} className="flex items-center gap-2 py-2">
                <div className="flex flex-col">
                  <button aria-label="Move up" disabled={idx === 0 || busy} onClick={() => move(idx, -1)} className="h-9 w-9 rounded-lg bg-slate-100 text-lg disabled:opacity-30">
                    ▲
                  </button>
                  <button aria-label="Move down" disabled={idx === stages.length - 1 || busy} onClick={() => move(idx, 1)} className="h-9 w-9 rounded-lg bg-slate-100 text-lg disabled:opacity-30">
                    ▼
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {s.sequence}. {s.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {s.plannedQty} {s.unit} · {s.plannedDays} days
                    {s.hasProgress && " · has progress"}
                  </div>
                </div>
                <button onClick={() => setEditing(s.id)} className="min-h-[40px] rounded-lg border-2 border-slate-300 px-3 text-sm font-semibold">
                  Edit
                </button>
                {!s.hasProgress && (
                  <button
                    onClick={() => {
                      const reason = window.prompt(`Remove stage "${s.name}"? Give a reason:`);
                      if (!reason || reason.trim().length < 3) return;
                      submit(() => api(`/api/stages/${s.id}/void`, { body: { reason } }));
                    }}
                    className="min-h-[40px] rounded-lg px-2 text-sm font-semibold text-red-600"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                )}
              </li>
            ),
          )}
        </ol>
      </Card>

      {adding ? (
        <Card title="Add stage" hi="स्टेज जोड़ें">
          <StageForm
            busy={busy}
            initial={{ name: "", unit: "MT", plannedQty: plannedTonnage || 1, plannedDays: 10 }}
            onCancel={() => setAdding(false)}
            onSave={async (data) => {
              const r = await submit(() => api(`/api/jobs/${jobId}/stages`, { body: data }));
              if (r) setAdding(false);
            }}
          />
        </Card>
      ) : (
        <Button full variant="outline" onClick={() => setAdding(true)}>
          + <Bi en="Add another stage" hi="एक और स्टेज जोड़ें" />
        </Button>
      )}
    </div>
  );
}

function StageForm({
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
      <datalist id="stage-presets">
        {STAGE_PRESETS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="grid grid-cols-3 gap-2">
        <Select label="Unit" hi="इकाई" value={unit} onChange={(e) => setUnit(e.target.value as QtyUnit)}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
        <Input label="Planned qty" hi="मात्रा" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" required />
        <Input label="Planned days" hi="दिन" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" required />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" loading={busy}>
          <Bi en="Save" hi="सेव" />
        </Button>
      </div>
    </form>
  );
}
