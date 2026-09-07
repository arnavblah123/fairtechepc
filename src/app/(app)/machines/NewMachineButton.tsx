"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { MACHINE_TYPES } from "@/lib/machine-labels";

export function NewMachineButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("WELDING_MACHINE");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const { busy, submit } = useSubmit();
  if (!open) {
    return <button onClick={() => setOpen(true)} className="min-h-[40px] rounded-xl bg-brand px-3 text-sm font-semibold text-white">+ Add</button>;
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-bold">New machine (factory register)</h2>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const r = await submit(() => api("/api/machines", { body: { type, make, model, serialNo } }));
          if (r) setOpen(false);
        }}>
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {MACHINE_TYPES.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
          </Select>
          <Input label="Make" value={make} onChange={(e) => setMake(e.target.value)} />
          <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} />
          <Input label="Serial no" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
          <Button type="submit" full loading={busy}>Add machine</Button>
        </form>
      </div>
    </div>
  );
}
