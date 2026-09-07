"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate, formatDateTime, formatNum } from "@/lib/format";
import type { DprData } from "@/lib/dpr";

const SLOT_LABELS = ["8–10", "10–12", "12–2", "2–4", "4–6"];

export function DprView({
  siteId,
  siteName,
  date,
  today,
  data,
  submitted,
  canSubmit,
}: {
  siteId: string;
  siteName: string;
  date: string;
  today: string;
  data: DprData;
  submitted: { by: string; at: string; remark: string } | null;
  canSubmit: boolean;
}) {
  const router = useRouter();
  const [remark, setRemark] = useState("");
  const { busy, submit } = useSubmit();
  const shift = (days: number) => {
    const d = new Date(date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    const key = d.toISOString().slice(0, 10);
    if (key <= today) router.push(`/dpr?date=${key}`);
  };

  return (
    <div className="print:text-sm">
      <div className="no-print">
        <PageHeader
          title="Daily Progress Report"
          hi="डीपीआर"
          back="/more"
          action={
            <button onClick={() => window.print()} className="min-h-[40px] rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-semibold">🖨 Print</button>
          }
        />
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm">
          <button onClick={() => shift(-1)} className="h-11 w-11 rounded-xl bg-slate-100 text-lg font-bold">‹</button>
          <div className="font-bold">{formatDate(date)}</div>
          <button onClick={() => shift(1)} disabled={date >= today} className="h-11 w-11 rounded-xl bg-slate-100 text-lg font-bold disabled:opacity-30">›</button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="hidden print:block">
          <h1 className="text-lg font-bold">DPR — {siteName} — {formatDate(date)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {submitted ? <Badge tone="green">Submitted by {submitted.by} · {formatDateTime(submitted.at)}</Badge> : <Badge tone="amber">Not submitted yet</Badge>}
          {data.holiday && <Badge tone="blue">Holiday: {data.holiday}</Badge>}
          <Badge tone={data.photoSlotsFilled.length >= 5 ? "green" : "red"}>Photos {data.photoSlotsFilled.length}/5</Badge>
        </div>

        <Card title="Manpower" hi="मज़दूर">
          {data.manpower.length === 0 ? (
            <p className="text-sm text-slate-500">No attendance marked.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th>Trade</th><th className="text-right">Present</th><th className="text-right">Half</th><th className="text-right">Absent</th><th className="text-right">OT hrs</th></tr></thead>
              <tbody>
                {data.manpower.map((m) => (
                  <tr key={m.trade} className="border-t">
                    <td className="py-1">{m.trade}</td>
                    <td className="text-right">{m.present}</td>
                    <td className="text-right">{m.halfDay}</td>
                    <td className="text-right text-red-600">{m.absent}</td>
                    <td className="text-right">{formatNum(m.otHours, 1)}</td>
                  </tr>
                ))}
                <tr className="border-t font-bold"><td className="py-1">Total present</td><td className="text-right" colSpan={4}>{formatNum(data.totalPresent, 1)}</td></tr>
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Plan vs done" hi="योजना बनाम काम">
          {data.plan.length === 0 && data.extraProgress.length === 0 ? (
            <p className="text-sm text-slate-500">No plan and no progress entries.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th>Job · Stage</th><th className="text-right">Target</th><th className="text-right">Done</th></tr></thead>
              <tbody>
                {data.plan.map((p, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1">{p.job} · {p.stage}</td>
                    <td className="text-right">{formatNum(p.targetQty)} {p.unit}</td>
                    <td className={`text-right font-semibold ${p.doneQty >= p.targetQty ? "text-green-700" : "text-amber-700"}`}>{formatNum(p.doneQty)} {p.unit}</td>
                  </tr>
                ))}
                {data.extraProgress.map((p, i) => (
                  <tr key={`x${i}`} className="border-t">
                    <td className="py-1">{p.job} · {p.stage} <span className="text-xs text-slate-400">(unplanned)</span></td>
                    <td className="text-right">—</td>
                    <td className="text-right font-semibold">{formatNum(p.doneQty)} {p.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Consumables used" hi="सामान खपत">
          {data.consumables.length === 0 ? <p className="text-sm text-slate-500">Nothing entered.</p> : (
            <ul className="divide-y text-sm">
              {data.consumables.map((c, i) => (
                <li key={i} className="flex justify-between py-1"><span>{c.item} <span className="text-xs text-slate-500">({c.job})</span></span><b>{formatNum(c.qty)} {c.unit}</b></li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Machines" hi="मशीनें">
          {data.machines.length === 0 ? <p className="text-sm text-slate-500">No machines at site.</p> : (
            <div className="flex flex-wrap gap-2">
              {data.machines.map((m) => (
                <Badge key={m.status} tone={m.status.includes("Repair") ? "red" : m.status === "Running" ? "green" : "slate"}>{m.status}: {m.count}</Badge>
              ))}
            </div>
          )}
        </Card>

        <Card title="Open issues" hi="खुली समस्याएँ">
          {data.openIssues.length === 0 ? <p className="text-sm text-green-700">No open issues 🎉</p> : (
            <ul className="divide-y text-sm">
              {data.openIssues.map((i, idx) => (
                <li key={idx} className="py-1.5">
                  <Badge tone={i.severity === "WORK_STOPPED" ? "red" : i.severity === "HIGH" ? "amber" : "slate"}>{i.severity.replace("_", " ")}</Badge>{" "}
                  <span className="font-semibold">{i.category}</span> · {i.description}
                  <span className="text-xs text-slate-500"> · open {i.ageHours}h</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Photos" hi="फोटो">
          <div className="mb-2 flex gap-1">
            {SLOT_LABELS.map((l, i) => (
              <span key={l} className={`flex-1 rounded-lg py-1 text-center text-xs font-bold text-white ${data.photoSlotsFilled.includes(i + 1) ? "bg-green-600" : "bg-red-500"}`}>{l}</span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {data.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.caption ?? ""} className="h-24 w-full rounded-lg object-cover" /></a>
            ))}
          </div>
        </Card>

        {submitted?.remark && (
          <Card title="In-charge remark" hi="टिप्पणी"><p className="text-sm">{submitted.remark}</p></Card>
        )}

        {!submitted && canSubmit && (
          <Card title="Submit DPR" hi="डीपीआर भेजें" className="no-print">
            <Textarea label="Remark for the day" hi="आज की टिप्पणी" value={remark} onChange={(e) => setRemark(e.target.value)} />
            <Button size="lg" full loading={busy} className="mt-3" onClick={() => submit(() => api(`/api/dpr?siteId=${siteId}`, { body: { date, remark } }))}>
              <Bi en="Submit DPR" hi="डीपीआर सबमिट करें" />
            </Button>
            <p className="mt-2 text-xs text-slate-500">Submit before 8 PM. The report above is frozen exactly as it looks now.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
