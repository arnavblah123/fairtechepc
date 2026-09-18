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
            plannedTonnage: f.plannedTonnage === "" ? null : Number(f.plannedTonnage),
            weldingNormKgPerMT: f.weldingNormKgPerMT === "" ? null : Number(f.weldingNormKgPerMT),
          };
          if (job?.id) {
            submit(() => api(`/api/jobs/${job.id}`, { method: "PATCH", body }), { to: `/jobs/${job.id}` });
          } else {
            const r = await submit(async () => api<{ id: string }>("/api/jobs", { body: { ...body, siteId } }), { refresh: false });
            if (r) window.location.href = `/jobs/${r.id}/stages`;
          }
        }}
      >
        <Input label="Job name" hi="काम का नाम" value={f.name} onChange={set("name")} required />
        <Input label="Client name" hi="क्लाइंट" value={f.clientName} onChange={set("clientName")} required />
        <Input label="Drawing reference" hi="ड्रॉइंग नंबर" value={f.drawingRef} onChange={set("drawingRef")} />
        <Textarea label="Description" hi="विवरण" value={f.description} onChange={set("description")} />
        <Input label="Planned tonnage (MT) — optional" hi="टन (वैकल्पिक)" value={f.plannedTonnage} onChange={set("plannedTonnage")} inputMode="decimal" hint="For reference only. Progress is tracked stage by stage, not by tonnage." />
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
          <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            Next screen: write all the stages for this job in one go, with planned quantity and days for each.
          </p>
        )}
        <Button type="submit" size="lg" full loading={busy}>
          <Bi en={job ? "Save changes" : "Create job"} hi={job ? "बदलाव सेव करें" : "काम बनाएँ"} />
        </Button>
      </form>
    </Card>
  );
}
