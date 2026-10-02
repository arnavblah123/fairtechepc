"use client";
import { useState } from "react";
import type { JobStatus } from "@prisma/client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { StageGrid, presetStages, usableStages, type StageDraft } from "./StageGrid";

export type JobFormData = {
  id?: string;
  name: string;
  clientName: string;
  description: string;
  drawingRef: string;
  plannedStart: string;
  plannedEnd: string;
  weldingNormKgPerMT: string;
  status: JobStatus;
};

/** Job and its stages in one save; nothing to come back for. */
export function JobForm({ siteId, job }: { siteId: string; job?: JobFormData }) {
  const [f, setF] = useState<JobFormData>(
    job ?? { name: "", clientName: "", description: "", drawingRef: "", plannedStart: "", plannedEnd: "", weldingNormKgPerMT: "", status: "ACTIVE" },
  );
  const [stages, setStages] = useState<StageDraft[]>(presetStages());
  const [withQty, setWithQty] = useState(false);
  const { busy, submit } = useSubmit();
  const set = (k: keyof JobFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const ready = usableStages(stages);

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = { ...f, weldingNormKgPerMT: f.weldingNormKgPerMT === "" ? null : Number(f.weldingNormKgPerMT) };
          if (job?.id) {
            submit(() => api(`/api/jobs/${job.id}`, { method: "PATCH", body }), { to: `/jobs/${job.id}` });
          } else {
            const r = await submit(() => api<{ id: string }>("/api/jobs", { body: { ...body, siteId, stages: ready } }), { refresh: false });
            if (r) window.location.href = `/jobs/${r.id}`;
          }
        }}
      >
        <Input label="Job name" hi="काम का नाम" value={f.name} onChange={set("name")} required />
        <Input label="Client name" hi="क्लाइंट" value={f.clientName} onChange={set("clientName")} required />
        <Input label="Drawing reference" hi="ड्रॉइंग नंबर" value={f.drawingRef} onChange={set("drawingRef")} />
        <Textarea label="Description" hi="विवरण" value={f.description} onChange={set("description")} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Planned start" hi="शुरू" type="date" value={f.plannedStart} onChange={set("plannedStart")} required />
          <Input label="Planned end" hi="खत्म" type="date" value={f.plannedEnd} onChange={set("plannedEnd")} required />
        </div>
        {job && (
          <Select label="Status" hi="स्थिति" value={f.status} onChange={set("status")}>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CLOSED">Closed</option>
          </Select>
        )}
        <Input label="Welding norm, kg per MT (optional)" hi="वेल्डिंग नॉर्म" value={f.weldingNormKgPerMT} onChange={set("weldingNormKgPerMT")} inputMode="decimal" hint="Only used when stage quantities are tracked in MT." />

        {!job && (
          <div className="border-t pt-4">
            <StageGrid drafts={stages} onChange={setStages} withQty={withQty} onToggleQty={setWithQty} />
          </div>
        )}

        <Button type="submit" size="lg" full loading={busy}>
          <Bi en={job ? "Save changes" : `Create job with ${ready.length} stages`} hi={job ? "बदलाव सेव करें" : "काम और स्टेज बनाएँ"} />
        </Button>
      </form>
    </Card>
  );
}
