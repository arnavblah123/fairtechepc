"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Shift, Trade } from "@prisma/client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { formatDate, formatNum } from "@/lib/format";
import { TRADE_LABELS } from "@/lib/labels";

type WorkerRow = { id: string; code: string; name: string; trade: Trade };
type Entry = { qtyDone: string; percentComplete: string; remark: string; workers: { workerId: string; hours: number; shift: Shift }[] };
type StageRow = { id: string; name: string; unit: string; plannedQty: number; entry: Entry | null };

export function ProgressEditor({
  date,
  today,
  yesterday,
  jobId,
  stages,
  workers,
  busyWorkers,
}: {
  date: string;
  today: string;
  yesterday: string;
  jobId: string;
  stages: StageRow[];
  workers: WorkerRow[];
  busyWorkers: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm">
        {[yesterday, today].map((d) => (
          <button key={d} onClick={() => router.push(`/jobs/${jobId}/progress?date=${d}`)} className={`min-h-[44px] flex-1 rounded-xl font-semibold ${d === date ? "bg-brand text-white" : "text-slate-600"}`}>
            {d === today ? "Today / आज" : "Yesterday / कल"} · {formatDate(d).slice(0, 5)}
          </button>
        ))}
      </div>
      {stages.map((s) => (
        <Card key={s.id}>
          <button className="flex w-full items-center justify-between" onClick={() => setOpen(open === s.id ? null : s.id)}>
            <div className="text-left">
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-slate-500">
                Planned {formatNum(s.plannedQty)} {s.unit}
                {s.entry ? ` · today: ${s.entry.qtyDone} ${s.unit}, ${s.entry.percentComplete}% · ${s.entry.workers.length} workers` : " · no entry"}
              </div>
            </div>
            <span className={`text-xl text-slate-400 transition ${open === s.id ? "rotate-90" : ""}`}>›</span>
          </button>
          {open === s.id && <StageForm key={date} stage={s} date={date} workers={workers} busyWorkers={busyWorkers} />}
        </Card>
      ))}
    </div>
  );
}

function StageForm({ stage, date, workers, busyWorkers }: { stage: StageRow; date: string; workers: WorkerRow[]; busyWorkers: Record<string, string> }) {
  const [qty, setQty] = useState(stage.entry?.qtyDone ?? "");
  const [pct, setPct] = useState(stage.entry?.percentComplete ?? "");
  const [remark, setRemark] = useState(stage.entry?.remark ?? "");
  const [sel, setSel] = useState<Map<string, number>>(new Map((stage.entry?.workers ?? []).map((w) => [w.workerId, w.hours])));
  const [showPick, setShowPick] = useState(false);
  const { busy, submit } = useSubmit();
  const mine = new Set((stage.entry?.workers ?? []).map((w) => w.workerId));

  return (
    <form
      className="mt-3 space-y-3 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() =>
          api("/api/progress", {
            body: {
              stageId: stage.id,
              date,
              qtyDone: Number(qty || 0),
              percentComplete: Number(pct || 0),
              remark,
              workers: [...sel.entries()].map(([workerId, hours]) => ({ workerId, hours, shift: "DAY" })),
            },
          }),
        );
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <Input label={`Qty done today (${stage.unit})`} hi="आज की मात्रा" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" required />
        <Input label="Total % complete" hi="कुल %" value={pct} onChange={(e) => setPct(e.target.value)} inputMode="numeric" required />
      </div>
      <div>
        <div className="mb-1 text-sm font-semibold text-slate-700">
          <Bi en={`Workers on this stage (${sel.size})`} hi="इस स्टेज पर मज़दूर" inline />
        </div>
        {[...sel.entries()].map(([id, hours]) => {
          const w = workers.find((x) => x.id === id);
          if (!w) return null;
          return (
            <div key={id} className="mb-1 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-sm">
                {w.name} <span className="text-xs text-slate-500">({TRADE_LABELS[w.trade].en})</span>
              </span>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="16"
                value={hours}
                onChange={(e) => setSel(new Map(sel).set(id, Number(e.target.value)))}
                className="w-16 rounded-lg border-2 border-slate-300 p-1 text-center text-sm"
                aria-label="hours"
              />
              <span className="text-xs text-slate-500">hrs</span>
              <button type="button" className="px-1 font-bold text-red-600" onClick={() => { const m = new Map(sel); m.delete(id); setSel(m); }}>✕</button>
            </div>
          );
        })}
        <button type="button" onClick={() => setShowPick(!showPick)} className="mt-1 w-full rounded-xl border-2 border-dashed border-slate-300 py-2 text-sm font-semibold text-slate-600">
          + <Bi en="Add workers" hi="मज़दूर जोड़ें" inline />
        </button>
        {showPick && (
          <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border">
            {workers
              .filter((w) => !sel.has(w.id))
              .map((w) => {
                const busyOn = !mine.has(w.id) ? busyWorkers[`${w.id}:DAY`] : undefined;
                return (
                  <button
                    key={w.id}
                    type="button"
                    disabled={!!busyOn}
                    onClick={() => setSel(new Map(sel).set(w.id, 8))}
                    className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 disabled:opacity-50"
                  >
                    <span>
                      {w.name} <span className="text-xs text-slate-500">({TRADE_LABELS[w.trade].en})</span>
                    </span>
                    {busyOn && <span className="text-xs text-amber-700">on {busyOn}</span>}
                  </button>
                );
              })}
          </div>
        )}
      </div>
      <Input label="Remark" hi="टिप्पणी" value={remark} onChange={(e) => setRemark(e.target.value)} />
      <Button type="submit" full loading={busy}>
        <Bi en="Save stage progress" hi="प्रगति सेव करें" />
      </Button>
    </form>
  );
}
