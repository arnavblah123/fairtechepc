"use client";
import { useState } from "react";
import type { JobStatus } from "@prisma/client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";

export type JobFormData = {
  id?: string;
  name: string;
  clientName: string;
  description: string;
  drawingRef: string;
  plannedTonnage: string;
  plannedStart: string;
  plannedEnd: string;
  weldingNormKgPerMT: string;
  status: JobStatus;
};

export function JobForm({ siteId, job, withPreset }: { siteId: string; job?: JobFormData; withPreset?: boolean }) {
  const [f, setF] = useState<JobFormData>(
    job ?? { name: "", clientName: "", description: "", drawingRef: "", plannedTonnage: "", plannedStart: "", plannedEnd: "", weldingNormKgPerMT: "", status: "ACTIVE" },
  );
  const [preset, setPreset] = useState(true);
  const { busy, submit } = useSubmit();
  const set = (k: keyof JobFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = {
            ...f,
            plannedTonnage: Number(f.plannedTonnage),
            weldingNormKgPerMT: f.weldingNormKgPerMT === "" ? null : Number(f.weldingNormKgPerMT),
          };
          if (job?.id) {
            submit(() => api(`/api/jobs/${job.id}`, { method: "PATCH", body }), { to: `/jobs/${job.id}` });
          } else {
            const r = await submit(
              async () => {
                const created = await api<{ id: string }>("/api/jobs", { body: { ...body, siteId } });
                if (withPreset && preset) await api(`/api/jobs/${created.id}/stages`, { body: { stages: PRESET_STAGES(Number(f.plannedTonnage)) } });
                return created;
              },
              { refresh: false },
            );
            if (r) window.location.href = `/jobs/${r.id}/stages`;
          }
        }}
      >
        <Input label="Job name" hi="काम का नाम" value={f.name} onChange={set("name")} required />
        <Input label="Client name" hi="क्लाइंट" value={f.clientName} onChange={set("clientName")} required />
        <Input label="Drawing reference" hi="ड्रॉइंग नंबर" value={f.drawingRef} onChange={set("drawingRef")} />
        <Textarea label="Description" hi="विवरण" value={f.description} onChange={set("description")} />
        <Input label="Planned tonnage (MT)" hi="योजना टन" value={f.plannedTonnage} onChange={set("plannedTonnage")} inputMode="decimal" required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Planned start" hi="शुरू" type="date" value={f.plannedStart} onChange={set("plannedStart")} required />
          <Input label="Planned end" hi="खत्म" type="date" value={f.plannedEnd} onChange={set("plannedEnd")} required />
        </div>
        <Input label="Welding norm (kg per MT)" hi="वेल्डिंग नॉर्म" value={f.weldingNormKgPerMT} onChange={set("weldingNormKgPerMT")} inputMode="decimal" hint="Consumption above this per MT fabricated is flagged. Leave blank to skip." />
        {job && (
          <Select label="Status" hi="स्थिति" value={f.status} onChange={set("status")}>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CLOSED">Closed</option>
          </Select>
        )}
        {withPreset && (
          <label className="flex min-h-[48px] items-center gap-3 rounded-xl bg-blue-50 px-3 py-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={preset} onChange={(e) => setPreset(e.target.checked)} />
            <span>
              Add the standard 8 stages (Marking → Dispatch/Erection) now. You can edit quantities and days on the next screen.
            </span>
          </label>
        )}
        <Button type="submit" size="lg" full loading={busy}>
          <Bi en={job ? "Save changes" : "Create job"} hi={job ? "बदलाव सेव करें" : "काम बनाएँ"} />
        </Button>
      </form>
    </Card>
  );
}

function PRESET_STAGES(tonnage: number) {
  const mt = tonnage > 0 ? tonnage : 1;
  return [
    { name: "Marking", unit: "MT", plannedQty: mt, plannedDays: 10 },
    { name: "Cutting", unit: "MT", plannedQty: mt, plannedDays: 12 },
    { name: "Fit-up", unit: "MT", plannedQty: mt, plannedDays: 20 },
    { name: "Welding", unit: "MT", plannedQty: mt, plannedDays: 25 },
    { name: "Grinding", unit: "MT", plannedQty: mt, plannedDays: 10 },
    { name: "Inspection", unit: "MT", plannedQty: mt, plannedDays: 6 },
    { name: "Blasting/Painting", unit: "SQM", plannedQty: Math.round(mt * 20), plannedDays: 12 },
    { name: "Dispatch/Erection", unit: "MT", plannedQty: mt, plannedDays: 15 },
  ];
}
