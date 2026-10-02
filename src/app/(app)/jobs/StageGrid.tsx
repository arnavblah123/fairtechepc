"use client";
import type { QtyUnit } from "@prisma/client";
import { Bi } from "@/components/ui/Bi";
import { STAGE_PRESETS } from "@/lib/validation";

export type StageDraft = { name: string; unit: QtyUnit; plannedQty: string; plannedDays: string };
const UNITS: QtyUnit[] = ["MT", "NOS", "METRE", "SQM"];
const PRESET_DAYS = [10, 12, 20, 25, 10, 6, 12, 15];

export const blankStage = (): StageDraft => ({ name: "", unit: "MT", plannedQty: "", plannedDays: "" });
export const presetStages = (): StageDraft[] =>
  STAGE_PRESETS.map((name, i) => ({ name, unit: name.startsWith("Blasting") ? "SQM" : "MT", plannedQty: "", plannedDays: String(PRESET_DAYS[i] ?? 10) }));

/** Rows that will actually be saved: a name and at least one planned day. */
export function usableStages(drafts: StageDraft[]) {
  return drafts
    .filter((d) => d.name.trim() && Number(d.plannedDays) > 0)
    .map((d) => ({ name: d.name.trim(), unit: d.unit, plannedQty: Number(d.plannedQty || 0), plannedDays: Number(d.plannedDays) }));
}

/**
 * Every stage in one grid: name and planned days are what matter. Quantity is
 * behind a switch for the jobs where they actually measure it.
 */
export function StageGrid({
  drafts,
  onChange,
  startAt = 1,
  withQty,
  onToggleQty,
}: {
  drafts: StageDraft[];
  onChange: (next: StageDraft[]) => void;
  startAt?: number;
  withQty: boolean;
  onToggleQty: (v: boolean) => void;
}) {
  const patch = (i: number, p: Partial<StageDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...p } : d)));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          <Bi en="Stages, in order" hi="स्टेज, क्रम में" inline />
        </span>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" className="h-4 w-4" checked={withQty} onChange={(e) => onToggleQty(e.target.checked)} />
          also track quantity
        </label>
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
            {withQty && (
              <div className="mt-2 flex gap-2 pl-7">
                <select className="w-24 rounded-lg border-2 border-slate-300 p-2 text-sm" value={d.unit} onChange={(e) => patch(i, { unit: e.target.value as QtyUnit })} aria-label="Unit">
                  {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
                </select>
                <input className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 p-2 text-sm" inputMode="decimal" placeholder="Planned quantity (optional)" value={d.plannedQty} onChange={(e) => patch(i, { plannedQty: e.target.value })} aria-label="Planned quantity" />
              </div>
            )}
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
