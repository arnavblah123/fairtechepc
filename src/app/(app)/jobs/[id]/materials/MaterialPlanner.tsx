"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { formatNum, titleCase } from "@/lib/format";

type Item = { id: string; name: string; unit: string; category: string };
type Planned = { id: string; itemId: string; name: string; unit: string; plannedQty: number; note: string; requested: number; consumed: number };
type Draft = { itemId: string; qty: string; note: string };

/**
 * Everything the job will need, decided before work starts. Site requests are
 * then checked against this plan, so nobody has to guess what is normal.
 */
export function MaterialPlanner({ jobId, items, planned, canDelete }: { jobId: string; items: Item[]; planned: Planned[]; canDelete: boolean }) {
  const { busy, submit } = useSubmit();
  const plannedIds = new Set(planned.map((p) => p.itemId));
  const available = items.filter((i) => !plannedIds.has(i.id));
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [search, setSearch] = useState("");

  const patch = (i: number, p: Partial<Draft>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...p } : d)));
  const filtered = available.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) && !drafts.some((d) => d.itemId === i.id));

  const save = async () => {
    const rows = drafts.filter((d) => d.itemId && Number(d.qty) > 0).map((d) => ({ itemId: d.itemId, plannedQty: Number(d.qty), note: d.note }));
    if (!rows.length) return;
    const r = await submit(() => api(`/api/jobs/${jobId}/materials`, { body: { items: rows } }));
    if (r) setDrafts([]);
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
        <Bi en="List every consumable this job will need, with quantity. Site requests are compared against this plan." hi="इस काम में जो भी सामान लगेगा, मात्रा के साथ यहाँ लिखें।" />
      </p>

      {planned.length > 0 && (
        <Card title={`Planned for this job (${planned.length})`} hi="योजना में">
          <ul className="divide-y">
            {planned.map((p) => {
              const over = p.consumed > p.plannedQty;
              return (
                <li key={p.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="shrink-0 font-bold">{formatNum(p.plannedQty)} {p.unit}</span>
                    {canDelete && <DeleteButton entity="JobMaterial" id={p.id} what={`${p.name} from the plan`} icon />}
                  </div>
                  <div className={`text-xs ${over ? "font-semibold text-red-600" : "text-slate-500"}`}>
                    Requested {formatNum(p.requested)} · used {formatNum(p.consumed)} {p.unit}
                    {over && " — over plan"}
                  </div>
                  {p.note && <div className="text-xs text-slate-500">{p.note}</div>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title="Add materials" hi="सामान जोड़ें">
        {drafts.length > 0 && (
          <div className="mb-3 space-y-2">
            {drafts.map((d, i) => {
              const item = items.find((x) => x.id === d.itemId);
              return (
                <div key={i} className="rounded-xl border border-slate-200 p-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item?.name}</span>
                    <button type="button" className="px-1 font-bold text-red-600" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}>✕</button>
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    <input className="w-28 rounded-lg border-2 border-slate-300 p-2 text-sm" inputMode="decimal" placeholder={`Qty (${item?.unit ?? ""})`} value={d.qty} onChange={(e) => patch(i, { qty: e.target.value })} aria-label="Quantity" />
                    <input className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 p-2 text-sm" placeholder="Note (optional)" value={d.note} onChange={(e) => patch(i, { note: e.target.value })} />
                  </div>
                </div>
              );
            })}
            <Button size="lg" full loading={busy} onClick={save}>
              <Bi en={`Save ${drafts.filter((d) => Number(d.qty) > 0).length} materials`} hi="सेव करें" />
            </Button>
          </div>
        )}
        <input
          className="mb-2 w-full rounded-xl border-2 border-slate-300 p-3 text-base"
          placeholder="Search item to add…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-72 overflow-y-auto rounded-xl border">
          {filtered.slice(0, 60).map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => { setDrafts([...drafts, { itemId: i.id, qty: "", note: "" }]); setSearch(""); }}
              className="flex w-full items-center justify-between border-b px-3 py-2.5 text-left text-sm last:border-0"
            >
              <span className="min-w-0 truncate">{i.name}</span>
              <span className="shrink-0 text-xs text-slate-400">{titleCase(i.category)}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">Nothing left to add.</p>}
        </div>
      </Card>
    </div>
  );
}
