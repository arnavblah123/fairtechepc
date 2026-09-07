"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/Toast";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { CameraInput } from "@/components/forms/CameraInput";
import { Input, Select } from "@/components/ui/Field";
import { formatDate, formatDateTime } from "@/lib/format";
import { PHOTO_SLOTS } from "@/lib/slots";

type Photo = { id: string; url: string; slot: number | null; kind: string; caption: string | null; lat: number; lng: number; time: string; by: string; job: string | null; stage: string | null };
type Job = { id: string; label: string; stages: { id: string; name: string }[] };

export function PhotoBoard({
  siteId, date, today, canUpload, jobs, photographers, filters, photos,
}: {
  siteId: string; date: string; today: string; canUpload: boolean;
  jobs: Job[]; photographers: { id: string; name: string }[];
  filters: { jobId: string; by: string };
  photos: Photo[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [caption, setCaption] = useState("");
  const [jobId, setJobId] = useState("");
  const [stageId, setStageId] = useState("");
  const filled = new Set(photos.filter((p) => p.slot !== null && p.kind === "DAILY_SLOT").map((p) => p.slot));
  const isToday = date === today;
  const nav = (params: Record<string, string>) => {
    const q = new URLSearchParams({ date, ...filters, ...params });
    [...q.entries()].forEach(([k, v]) => !v && q.delete(k));
    router.push(`/photos?${q}`);
  };
  const shift = (days: number) => {
    const d = new Date(date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    const key = d.toISOString().slice(0, 10);
    if (key <= today) nav({ date: key });
  };
  const job = jobs.find((j) => j.id === jobId);

  return (
    <div>
      <PageHeader title="Site photos" hi="साइट फोटो" back="/more" />
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm">
        <button onClick={() => shift(-1)} className="h-11 w-11 rounded-xl bg-slate-100 text-lg font-bold">‹</button>
        <div className="font-bold">{isToday ? `Today · ${formatDate(date)}` : formatDate(date)}</div>
        <button onClick={() => shift(1)} disabled={isToday} className="h-11 w-11 rounded-xl bg-slate-100 text-lg font-bold disabled:opacity-30">›</button>
      </div>

      <div className="mb-3 flex gap-1">
        {PHOTO_SLOTS.map((s) => (
          <span key={s.slot} className={`flex-1 rounded-lg py-1.5 text-center text-xs font-bold text-white ${filled.has(s.slot) ? "bg-green-600" : "bg-red-500"}`}>
            {s.label}
          </span>
        ))}
      </div>

      {canUpload && isToday && (
        <Card title="Add photo" hi="फोटो लें" className="mb-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select label="Job (optional)" hi="काम" value={jobId} onChange={(e) => { setJobId(e.target.value); setStageId(""); }}>
                <option value="">—</option>
                {jobs.map((j) => (<option key={j.id} value={j.id}>{j.label}</option>))}
              </Select>
              <Select label="Stage" hi="स्टेज" value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={!job}>
                <option value="">—</option>
                {job?.stages.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </Select>
            </div>
            <Input label="Caption (optional)" hi="कैप्शन" value={caption} onChange={(e) => setCaption(e.target.value)} />
            <CameraInput
              label="Take site photo"
              hi="फोटो लें"
              onCaptured={async (p) => {
                try {
                  const r = await api<{ slot: number | null }>(`/api/photos?siteId=${siteId}`, { body: { ...p, caption, jobId: jobId || null, stageId: stageId || null } });
                  toast.push({ kind: "success", en: r.slot ? `Saved in slot ${PHOTO_SLOTS[r.slot - 1].label} ✓` : "Saved (outside photo windows) ✓", hi: "फोटो सेव हो गई" });
                  setCaption("");
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            />
            <p className="text-xs text-slate-500">
              <Bi en="5 photos daily, one in each window. Missed windows stay red permanently." hi="रोज़ 5 फोटो, हर समय-खिड़की में एक। छूटी खिड़की हमेशा लाल रहेगी।" />
            </p>
          </div>
        </Card>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Select label="Filter: job" hi="काम" value={filters.jobId} onChange={(e) => nav({ jobId: e.target.value })}>
          <option value="">All jobs</option>
          {jobs.map((j) => (<option key={j.id} value={j.id}>{j.label}</option>))}
        </Select>
        <Select label="Filter: photographer" hi="फोटो लेने वाला" value={filters.by} onChange={(e) => nav({ by: e.target.value })}>
          <option value="">Everyone</option>
          {photographers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </Select>
      </div>

      {photos.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-slate-500">No photos for this day.</p></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((p) => (
            <Card key={p.id} className="!p-2">
              <a href={p.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} className="h-36 w-full rounded-xl object-cover" />
              </a>
              <div className="mt-1 text-xs">
                <div className="font-semibold">
                  {p.kind === "MUSTER" ? "Muster" : p.slot ? PHOTO_SLOTS[p.slot - 1].label : "Extra"}
                  {p.job ? ` · ${p.job}` : ""}{p.stage ? ` · ${p.stage}` : ""}
                </div>
                {p.caption && <div className="truncate">{p.caption}</div>}
                <div className="text-slate-500">{p.by} · {formatDateTime(p.time).slice(11)}</div>
                <a className="font-semibold text-brand underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`}>📍 Map</a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
