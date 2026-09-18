"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Toggle } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { MACHINE_TYPES } from "@/lib/machine-labels";

export function NewMachineButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("WELDING_MACHINE");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [rented, setRented] = useState(false);
  const [rentVendor, setRentVendor] = useState("");
  const [rentPerMonth, setRentPerMonth] = useState("");
  const [rentFrom, setRentFrom] = useState("");
  const [rentTo, setRentTo] = useState("");
  const { busy, submit } = useSubmit();

  if (!open) {
    return <button onClick={() => setOpen(true)} className="min-h-[40px] rounded-xl bg-brand px-3 text-sm font-semibold text-white">+ Add</button>;
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-bold">New machine</h2>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const r = await submit(() => api("/api/machines", {
            body: {
              type, make, model, serialNo,
              ownership: rented ? "RENTED" : "OWNED",
              rentVendor, rentPerMonth: rentPerMonth ? Number(rentPerMonth) : null,
              rentFrom: rentFrom || null, rentTo: rentTo || null,
            },
          }));
          if (r) setOpen(false);
        }}>
          <Select label="Type" hi="प्रकार" value={type} onChange={(e) => setType(e.target.value)}>
            {MACHINE_TYPES.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
          </Select>
          <Input label="Make" hi="मेक" value={make} onChange={(e) => setMake(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} />
            <Input label="Serial no" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
          </div>
          <Toggle label="On rent" hi="किराए पर है" checked={rented} onChange={setRented} hint="Off = our own machine" />
          {rented && (
            <div className="space-y-3 rounded-xl bg-amber-50 p-3">
              <Input label="Rented from" hi="किससे किराए पर" value={rentVendor} onChange={(e) => setRentVendor(e.target.value)} required />
              <Input label="Rent per month (₹)" hi="महीने का किराया" value={rentPerMonth} onChange={(e) => setRentPerMonth(e.target.value)} inputMode="numeric" />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Rent from" type="date" value={rentFrom} onChange={(e) => setRentFrom(e.target.value)} />
                <Input label="Rent till" type="date" value={rentTo} onChange={(e) => setRentTo(e.target.value)} />
              </div>
            </div>
          )}
          <Button type="submit" full loading={busy}><Bi en="Add machine" hi="मशीन जोड़ें" /></Button>
        </form>
      </div>
    </div>
  );
}
