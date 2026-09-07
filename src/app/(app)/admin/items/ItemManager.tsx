"use client";
import { useState } from "react";
import type { ConsumableCategory } from "@prisma/client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Toggle } from "@/components/ui/Field";
import { Badge, Card } from "@/components/ui/Card";
import { titleCase } from "@/lib/format";

type Item = { id?: string; name: string; category: ConsumableCategory; unit: string; reorderLevel: number; isWeldingConsumable: boolean; kgPerUnit: number | null; active: boolean };
const CATEGORIES: ConsumableCategory[] = ["WELDING_ELECTRODE", "MIG_WIRE", "GAS", "GRINDING", "CUTTING", "HAND_TOOL", "PPE_SAFETY", "PAINT", "HARDWARE", "OTHER"];
const BLANK: Item = { name: "", category: "OTHER", unit: "nos", reorderLevel: 0, isWeldingConsumable: false, kgPerUnit: null, active: true };

export function ItemManager({ items }: { items: Item[] }) {
  const [editing, setEditing] = useState<Item | null>(null);
  const { busy, submit } = useSubmit();
  return (
    <div className="space-y-4">
      {editing ? (
        <Card title={editing.id ? "Edit item" : "New item"}>
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            const body = { ...editing, kgPerUnit: editing.isWeldingConsumable ? editing.kgPerUnit : null };
            const r = await submit(() => (editing.id ? api(`/api/items/${editing.id}`, { method: "PATCH", body }) : api("/api/items", { body })));
            if (r) setEditing(null);
          }}>
            <Input label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            <div className="grid grid-cols-2 gap-2">
              <Select label="Category" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as ConsumableCategory })}>
                {CATEGORIES.map((c) => (<option key={c} value={c}>{titleCase(c)}</option>))}
              </Select>
              <Input label="Unit" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} required placeholder="kg / nos / litre" />
            </div>
            <Input label="Reorder level (low-stock alert)" value={String(editing.reorderLevel)} onChange={(e) => setEditing({ ...editing, reorderLevel: Number(e.target.value) })} inputMode="decimal" />
            <Toggle label="Welding consumable (counts in kg/MT norm)" checked={editing.isWeldingConsumable} onChange={(v) => setEditing({ ...editing, isWeldingConsumable: v })} />
            {editing.isWeldingConsumable && (
              <Input label="kg per unit" value={editing.kgPerUnit === null ? "" : String(editing.kgPerUnit)} onChange={(e) => setEditing({ ...editing, kgPerUnit: e.target.value === "" ? null : Number(e.target.value) })} inputMode="decimal" hint="e.g. 1 for kg items, 15 for a 15kg spool" />
            )}
            {editing.id && <Toggle label="Active" checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" className="flex-1" loading={busy}>Save</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Button full size="lg" onClick={() => setEditing(BLANK)}>+ Add item</Button>
      )}
      <Card>
        <ul className="divide-y text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex min-h-[48px] items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <span className={`font-semibold ${!i.active ? "text-slate-400 line-through" : ""}`}>{i.name}</span>
                <div className="text-xs text-slate-500">{titleCase(i.category)} · {i.unit} · reorder at {i.reorderLevel}{i.isWeldingConsumable ? ` · welding (${i.kgPerUnit ?? 1} kg/unit)` : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                {i.isWeldingConsumable && <Badge tone="blue">norm</Badge>}
                <button className="min-h-[40px] rounded-lg border-2 border-slate-300 px-3 font-semibold" onClick={() => setEditing(i)}>Edit</button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
