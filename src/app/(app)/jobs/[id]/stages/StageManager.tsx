"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { StageGrid, blankStage, presetStages, usableStages, type StageDraft } from "../../StageGrid";

type StageRow = { id: string; sequence: number; name: string; scope: string | null; plannedDays: number; hasProgress: boolean };

export function StageManager({ jobId, stages, canDelete }: { jobId: string; stages: StageRow[]; canDelete: boolean }) {
  const { busy, submit } = useSubmit();
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<StageDraft[]>(stages.length === 0 ? presetStages() : [blankStage()]);
  const [adding, setAdding] = useState(stages.length === 0);

  const move = (idx: number, dir: -1 | 1) => {
    const order = stages.map((s) => s.id);
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    submit(() => api(`/api/jobs/${jobId}/stages/reorder`, { body: { order } }));
  };

  const saveAll = async () => {
    const rows = usableStages(drafts);
    if (!rows.length) return;
    const r = await submit(() => api(`/api/jobs/${jobId}/stages/bulk`, { body: { stages: rows } }));
    if (r) {
      setDrafts([blankStage()]);
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Only you can add, rename, reorder or delete stages. Supervisors mark work done against them.
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
                        {s.plannedDays} days
                        {s.hasProgress && " · has progress"}
                      </div>
                      {s.scope && <div className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{s.scope}</div>}
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
            <Bi en="Name and planned days for each. Save once." hi="हर स्टेज का नाम और दिन। एक बार सेव करें।" />
          </p>
          <StageGrid drafts={drafts} onChange={setDrafts} startAt={stages.length + 1} />
          <Button size="lg" full className="mt-3" loading={busy} onClick={saveAll}>
            <Bi en={`Save ${usableStages(drafts).length} stages`} hi="सारी स्टेज सेव करें" />
          </Button>
          {stages.length > 0 && (
            <button className="mt-2 w-full text-sm font-semibold text-slate-500" onClick={() => setAdding(false)}>Cancel</button>
          )}
        </Card>
      ) : (
        <Button full variant="outline" onClick={() => { setDrafts([blankStage()]); setAdding(true); }}>
          + <Bi en="Add more stages" hi="और स्टेज जोड़ें" />
        </Button>
      )}
    </div>
  );
}

function SingleStageForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: { name: string; scope: string | null; plannedDays: number };
  busy: boolean;
  onSave: (d: { name: string; scope: string | null; plannedDays: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [scope, setScope] = useState(initial.scope ?? "");
  const [days, setDays] = useState(String(initial.plannedDays));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, scope: scope.trim() || null, plannedDays: Number(days) });
      }}
    >
      <Input label="Stage name" hi="स्टेज नाम" value={name} onChange={(e) => setName(e.target.value)} required list="stage-presets" />
      <Textarea label="What will be done" hi="क्या होगा" value={scope} onChange={(e) => setScope(e.target.value)} />
      <Input label="Planned days" hi="दिन" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" required />
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1" loading={busy}><Bi en="Save" hi="सेव" /></Button>
      </div>
    </form>
  );
}
