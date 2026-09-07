"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { CameraInput } from "@/components/forms/CameraInput";
import { ISSUE_CATEGORIES, SEVERITIES } from "@/lib/issue-labels";

export function IssueForm({ siteId, jobs }: { siteId: string; jobs: { id: string; label: string }[] }) {
  const [category, setCategory] = useState("MATERIAL_SHORTAGE");
  const [severity, setSeverity] = useState("MEDIUM");
  const [jobId, setJobId] = useState("");
  const [description, setDescription] = useState("");
  const [neededFromHO, setNeededFromHO] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const { busy, submit } = useSubmit();
  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => api(`/api/issues?siteId=${siteId}`, { body: { category, severity, jobId: jobId || null, description, neededFromHO, photoUrl } }), { to: "/issues" });
        }}
      >
        <Select label="Category" hi="प्रकार" value={category} onChange={(e) => setCategory(e.target.value)}>
          {ISSUE_CATEGORIES.map(([v, en, hi]) => (<option key={v} value={v}>{en} / {hi}</option>))}
        </Select>
        <div>
          <div className="mb-1 text-sm font-semibold text-slate-700"><Bi en="How serious?" hi="कितनी गंभीर?" inline /></div>
          <div className="grid grid-cols-4 gap-1">
            {SEVERITIES.map(([v, en, hi]) => (
              <button key={v} type="button" onClick={() => setSeverity(v)}
                className={`min-h-[52px] rounded-xl px-1 text-xs font-bold leading-tight ${severity === v ? (v === "WORK_STOPPED" ? "bg-red-600 text-white" : v === "HIGH" ? "bg-amber-500 text-white" : "bg-brand text-white") : "bg-slate-100 text-slate-600"}`}>
                {en}<br /><span className="font-normal opacity-80">{hi}</span>
              </button>
            ))}
          </div>
        </div>
        <Select label="Job (optional)" hi="काम" value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">—</option>
          {jobs.map((j) => (<option key={j.id} value={j.id}>{j.label}</option>))}
        </Select>
        <Textarea label="What is the problem?" hi="समस्या क्या है?" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={5} />
        <Textarea label="What do you need from head office?" hi="हेड ऑफिस से क्या चाहिए?" value={neededFromHO} onChange={(e) => setNeededFromHO(e.target.value)} />
        <CameraInput label="Photo (optional)" hi="फोटो" requireGeo={false} preview={photoUrl || null} onCaptured={(p) => setPhotoUrl(p.url)} />
        <Button type="submit" size="lg" full variant="danger" loading={busy}>
          <Bi en="Raise issue" hi="समस्या भेजें" />
        </Button>
      </form>
    </Card>
  );
}
