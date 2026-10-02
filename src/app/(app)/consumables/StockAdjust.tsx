"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";

/** Inline "set stock to…" for one item. Superadmin only; caller checks the role. */
export function StockAdjust({ siteId, itemId, name, unit, current }: { siteId: string; itemId: string; name: string; unit: string; current: number }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(current));
  const [reason, setReason] = useState("");
  const { busy, submit } = useSubmit();

  if (!open) {
    return (
      <button type="button" aria-label={`Change stock of ${name}`} onClick={() => setOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 text-sm font-bold text-slate-600">
        ✎
      </button>
    );
  }
  return (
    <form
      className="mt-1 w-full space-y-2 rounded-xl bg-slate-50 p-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await submit(() => api(`/api/consumables/stock?siteId=${siteId}`, { body: { itemId, qtyOnHand: Number(qty), reason } }));
        if (r) setOpen(false);
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Set to</span>
        <input className="w-28 rounded-lg border-2 border-slate-300 p-2 text-base" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="New quantity" autoFocus />
        <span className="text-xs text-slate-500">{unit}</span>
        <span className="ml-auto text-xs text-slate-400">was {current}</span>
      </div>
      <input className="w-full rounded-lg border-2 border-slate-300 p-2 text-sm" placeholder="Reason (counted, opening stock, wrong entry…)" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" className="flex-1" loading={busy} disabled={reason.trim().length < 3}>Save</Button>
      </div>
    </form>
  );
}
