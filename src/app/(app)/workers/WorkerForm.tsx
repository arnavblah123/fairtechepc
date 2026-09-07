"use client";
import { useState } from "react";
import type { Trade, WageType } from "@prisma/client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Toggle } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { TRADE_LABELS } from "@/lib/labels";
import { CameraInput } from "@/components/forms/CameraInput";

export type WorkerFormData = {
  id?: string;
  name: string;
  phone: string;
  trade: Trade;
  joiningDate: string;
  wageType: WageType;
  contractorName: string;
  idDocRef: string;
  photoUrl: string;
  active: boolean;
};

export function WorkerForm({ siteId, worker }: { siteId: string; worker?: WorkerFormData }) {
  const [f, setF] = useState<WorkerFormData>(
    worker ?? { name: "", phone: "", trade: "HELPER", joiningDate: new Date().toISOString().slice(0, 10), wageType: "PER_DAY", contractorName: "", idDocRef: "", photoUrl: "", active: true },
  );
  const { busy, submit } = useSubmit();
  const set = (k: keyof WorkerFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (worker?.id) submit(() => api(`/api/workers/${worker.id}`, { method: "PATCH", body: f }), { to: "/workers" });
          else submit(() => api(`/api/workers?siteId=${siteId}`, { body: f }), { to: "/workers" });
        }}
      >
        <Input label="Name" hi="नाम" value={f.name} onChange={set("name")} required />
        <CameraInput label="Worker photo (optional)" hi="फोटो" requireGeo={false} preview={f.photoUrl || null} onCaptured={(p) => setF((prev) => ({ ...prev, photoUrl: p.url }))} />
        <Input label="Phone" hi="फ़ोन" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} />
        <Select label="Trade" hi="काम" value={f.trade} onChange={set("trade")}>
          {(Object.keys(TRADE_LABELS) as Trade[]).map((t) => (
            <option key={t} value={t}>
              {TRADE_LABELS[t].en} / {TRADE_LABELS[t].hi}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Joining date" hi="तारीख़" type="date" value={f.joiningDate} onChange={set("joiningDate")} required />
          <Select label="Wage type" hi="मज़दूरी" value={f.wageType} onChange={set("wageType")}>
            <option value="PER_DAY">Per day / रोज़</option>
            <option value="PER_HOUR">Per hour / घंटा</option>
          </Select>
        </div>
        <Input label="Contractor (if sub-contract)" hi="ठेकेदार" value={f.contractorName} onChange={set("contractorName")} />
        <Input label="ID document number" hi="आईडी नंबर" value={f.idDocRef} onChange={set("idDocRef")} hint="Aadhaar/other reference number only. Do not upload the document." />
        {worker && <Toggle label="Active" hi="काम पर है" checked={f.active} onChange={(v) => setF({ ...f, active: v })} hint="Turn off when the worker leaves." />}
        <Button type="submit" size="lg" full loading={busy}>
          <Bi en={worker ? "Save changes" : "Add worker"} hi={worker ? "सेव करें" : "जोड़ें"} />
        </Button>
      </form>
    </Card>
  );
}
