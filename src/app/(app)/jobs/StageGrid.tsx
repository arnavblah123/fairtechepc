"use client";
import { Bi } from "@/components/ui/Bi";
import { STAGE_PRESETS } from "@/lib/validation";

export type StageDraft = { name: string; scope: string; plannedDays: string };
const PRESET_DAYS = [10, 12, 20, 25, 10, 6, 12, 15];

export const blankStage = (): StageDraft => ({ name: "", scope: "", plannedDays: "" });
export const presetStages = (): StageDraft[] => STAGE_PRESETS.map((name, i) => ({ name, scope: "", plannedDays: String(PRESET_DAYS[i] ?? 10) }));

/** Rows that will actually be saved: a name and at least one planned day. */
export function usableStages(drafts: StageDraft[]) {
  return drafts
    .filter((d) => d.name.trim() && Number(d.plannedDays) > 0)
    .map((d) => ({ name: d.name.trim(), scope: d.scope.trim() || null, plannedDays: Number(d.plannedDays) }));
}

/**
 * Every stage in one grid: the name, what will be done, and the planned days.
 * Time is the yardstick; there are no quantity targets.
 */
export function StageGrid({ drafts, onChange, startAt = 1 }: { drafts: StageDraft[]; onChange: (next: StageDraft[]) => void; startAt?: number }) {
  const patch = (i: number, p: Partial<StageDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...p } : d)));
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700">
        <Bi en="Stages, in order" hi="स्टेज, क्रम में" inline />
      </div>
      <div className="mb-1 flex gap-2 pl-7 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="flex-1">Stage</span>
        <span className="w-20">Days</span>
        <span className="w-7" />
      </div>
      <div className="space-y-2">
        {drafts.map((d, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-2">
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-sm font-bold text-slate-400">{startAt + i}</span>
              <input
                className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 p-2 text-base"
                placeholder="Stage name"
                list="stage-presets"
                value={d.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                aria-label="Stage name"
              />
              <input
                className="w-20 rounded-lg border-2 border-slate-300 p-2 text-base"
                inputMode="numeric"
                placeholder="days"
                value={d.plannedDays}
                onChange={(e) => patch(i, { plannedDays: e.target.value })}
                aria-label="Planned days"
              />
              <button type="button" aria-label="Remove row" className="w-7 font-bold text-red-600" onClick={() => onChange(drafts.filter((_, j) => j !== i))}>✕</button>
            </div>
            <textarea
              className="mt-2 ml-7 block w-[calc(100%-1.75rem)] rounded-lg border-2 border-slate-200 p-2 text-sm"
              rows={2}
              placeholder="What will be done in this stage / इस स्टेज में क्या होगा"
              value={d.scope}
              onChange={(e) => patch(i, { scope: e.target.value })}
              aria-label="What will be done"
            />
          </div>
        ))}
      </div>
      <datalist id="stage-presets">
        {STAGE_PRESETS.map((p) => (<option key={p} value={p} />))}
      </datalist>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" className="min-h-[44px] rounded-xl border-2 border-slate-300 bg-white text-sm font-semibold" onClick={() => onChange([...drafts, blankStage()])}>+ Add row</button>
        <button type="button" className="min-h-[44px] rounded-xl border-2 border-slate-300 bg-white text-sm font-semibold" onClick={() => onChange([...drafts.filter((d) => d.name.trim()), ...presetStages()])}>Fill standard 8</button>
      </div>
    </div>
  );
}
