"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttendanceStatus, Trade } from "@prisma/client";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/Toast";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { CameraInput } from "@/components/forms/CameraInput";
import { formatDate } from "@/lib/format";
import { TRADE_LABELS } from "@/lib/labels";

type WorkerRow = { id: string; code: string; name: string; trade: Trade; photoUrl: string | null };
type Mark = { workerId: string; status: AttendanceStatus; inTime: string | null; outTime: string | null; otHours: number; date: string };

const STATUS_BTNS: { v: AttendanceStatus; en: string; hi: string; on: string }[] = [
  { v: "PRESENT", en: "P", hi: "हाज़िर", on: "bg-green-600 text-white" },
  { v: "HALF_DAY", en: "½", hi: "आधा", on: "bg-amber-500 text-white" },
  { v: "ABSENT", en: "A", hi: "गैर", on: "bg-red-600 text-white" },
];

export function AttendanceBoard({
  siteId,
  date,
  today,
  yesterday,
  holiday,
  musterUrl,
  workers,
  initialRows,
}: {
  siteId: string;
  date: string;
  today: string;
  yesterday: string;
  holiday: string | null;
  musterUrl: string | null;
  workers: WorkerRow[];
  initialRows: Mark[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [muster, setMuster] = useState(musterUrl);
  const [marks, setMarks] = useState<Record<string, Mark>>(Object.fromEntries(initialRows.map((r) => [r.workerId, r])));
  const [detail, setDetail] = useState<string | null>(null);
  const counts = useMemo(() => {
    const list = Object.values(marks);
    return {
      present: list.filter((m) => m.status === "PRESENT").length + 0.5 * list.filter((m) => m.status === "HALF_DAY").length,
      absent: list.filter((m) => m.status === "ABSENT").length,
      marked: list.length,
    };
  }, [marks]);

  async function save(workerId: string, patch: Partial<Mark>) {
    const prev = marks[workerId];
    const base: Mark = prev ?? { workerId, date, status: "PRESENT", inTime: null, outTime: null, otHours: 0 };
    const next: Mark = { ...base, ...patch, workerId, date };
    setMarks((m) => ({ ...m, [workerId]: next })); // optimistic
    try {
      await api("/api/attendance", { body: next });
    } catch (e) {
      setMarks((m) => {
        const copy = { ...m };
        if (prev) copy[workerId] = prev;
        else delete copy[workerId];
        return copy;
      });
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm">
        {[yesterday, today].map((d) => (
          <button
            key={d}
            onClick={() => router.push(`/attendance?date=${d}`)}
            className={`min-h-[44px] flex-1 rounded-xl font-semibold ${d === date ? "bg-brand text-white" : "text-slate-600"}`}
          >
            {d === today ? "Today / आज" : "Yesterday / कल"} · {formatDate(d).slice(0, 5)}
          </button>
        ))}
      </div>

      {holiday && (
        <div className="rounded-2xl bg-blue-50 p-3 text-center font-semibold text-blue-800">
          🎉 {holiday} — <Bi en="Holiday" hi="छुट्टी" inline />
        </div>
      )}

      {!muster ? (
        <Card title="Step 1: Muster photo" hi="मस्टर फोटो">
          <p className="mb-2 text-sm text-slate-600">
            <Bi en="Take one group photo of all workers before marking attendance." hi="हाज़िरी से पहले सबकी एक ग्रुप फोटो लें।" />
          </p>
          <CameraInput
            label="Take muster photo"
            hi="मस्टर फोटो लें"
            onCaptured={async (p) => {
              try {
                await api(`/api/attendance/muster?siteId=${siteId}`, { body: { date, ...p } });
                setMuster(p.url);
                toast.saved();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          />
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm">
            <div className="text-sm">
              <span className="font-bold text-green-700">{counts.present}</span> present · <span className="font-bold text-red-700">{counts.absent}</span> absent ·{" "}
              <span className="text-slate-500">
                {counts.marked}/{workers.length} marked
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={muster} target="_blank" rel="noreferrer"><img src={muster} alt="muster" className="h-10 w-10 rounded-lg object-cover" /></a>
          </div>

          <Card>
            <ul className="divide-y">
              {workers.map((w) => {
                const m = marks[w.id];
                const open = detail === w.id;
                return (
                  <li key={w.id} className="py-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setDetail(open ? null : w.id)} className="min-w-0 flex-1 text-left">
                        <div className="truncate font-semibold">{w.name}</div>
                        <div className="text-xs text-slate-500">
                          {w.code} · {TRADE_LABELS[w.trade].en}
                          {m?.otHours ? ` · OT ${m.otHours}h` : ""}
                          {m?.inTime ? ` · ${m.inTime}–${m.outTime ?? ""}` : ""}
                        </div>
                      </button>
                      {holiday ? (
                        <button
                          onClick={() => save(w.id, { status: m?.status === "HOLIDAY" ? "PRESENT" : "HOLIDAY" })}
                          className={`min-h-[48px] rounded-xl px-3 text-sm font-bold ${m?.status === "HOLIDAY" ? "bg-blue-600 text-white" : "bg-slate-100"}`}
                        >
                          Holiday
                        </button>
                      ) : null}
                      {STATUS_BTNS.map((b) => (
                        <button
                          key={b.v}
                          aria-label={b.en}
                          onClick={() => save(w.id, { status: b.v })}
                          className={`h-12 w-12 shrink-0 rounded-xl text-lg font-bold ${m?.status === b.v ? b.on : "bg-slate-100 text-slate-500"}`}
                        >
                          {b.en}
                        </button>
                      ))}
                    </div>
                    {open && (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <label className="text-xs font-semibold text-slate-600">
                          In / आना
                          <input type="time" className="mt-1 w-full rounded-lg border-2 border-slate-300 p-2" value={m?.inTime ?? ""} onChange={(e) => save(w.id, { inTime: e.target.value || null })} />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Out / जाना
                          <input type="time" className="mt-1 w-full rounded-lg border-2 border-slate-300 p-2" value={m?.outTime ?? ""} onChange={(e) => save(w.id, { outTime: e.target.value || null })} />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          OT hours / ओटी
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="16"
                            className="mt-1 w-full rounded-lg border-2 border-slate-300 p-2"
                            value={m?.otHours ?? 0}
                            onChange={(e) => save(w.id, { otHours: Number(e.target.value) })}
                          />
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <button
            onClick={() => {
              const status: AttendanceStatus = holiday ? "HOLIDAY" : "PRESENT";
              workers.filter((w) => !marks[w.id]).forEach((w) => save(w.id, { status }));
            }}
            className="w-full rounded-xl border-2 border-slate-300 bg-white py-3 font-semibold text-slate-700"
          >
            <Bi en={holiday ? "Mark rest as holiday" : "Mark rest as present"} hi={holiday ? "बाकी सबकी छुट्टी" : "बाकी सब हाज़िर"} inline />
          </button>
        </>
      )}
    </div>
  );
}
