"use client";
import { useState } from "react";
import type { ConsumableCategory } from "@prisma/client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { titleCase } from "@/lib/format";

const CATEGORIES: ConsumableCategory[] = ["WELDING_ELECTRODE", "MIG_WIRE", "GAS", "GRINDING", "CUTTING", "HAND_TOOL", "PPE_SAFETY", "PAINT", "HARDWARE", "OTHER"];

/** Add an item to the master straight from the store screen. It appears in the list at once with zero stock. */
export function AddItemInline() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("nos");
  const [category, setCategory] = useState<ConsumableCategory>("OTHER");
  const [reorder, setReorder] = useState("0");
  const { busy, submit } = useSubmit();
  if (!open) {
    return (
      <Button full variant="outline" className="mb-3" onClick={() => setOpen(true)}>
        + <Bi en="Add item to store" hi="स्टोर में आइटम जोड़ें" />
      </Button>
    );
  }
  return (
    <Card title="New item" hi="नया आइटम" className="mb-3">
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const r = await submit(() => api("/api/items", { body: { name, unit, category, reorderLevel: Number(reorder || 0), isWeldingConsumable: category === "WELDING_ELECTRODE" || category === "MIG_WIRE", kgPerUnit: null, active: true } }));
        if (r) { setOpen(false); setName(""); setReorder("0"); }
      }}>
        <Input label="Item name" hi="नाम" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Unit" hi="इकाई" value={unit} onChange={(e) => setUnit(e.target.value)} required placeholder="kg / nos / litre" />
          <Select label="Category" hi="प्रकार" value={category} onChange={(e) => setCategory(e.target.value as ConsumableCategory)}>
            {CATEGORIES.map((c) => (<option key={c} value={c}>{titleCase(c)}</option>))}
          </Select>
        </div>
        <Input label="Low-stock alert below" hi="कम स्टॉक सीमा" value={reorder} onChange={(e) => setReorder(e.target.value)} inputMode="decimal" />
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={busy}>Add</Button>
        </div>
      </form>
    </Card>
  );
}
