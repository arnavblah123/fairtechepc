"use client";
import { useRouter } from "next/navigation";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExportLink } from "@/components/forms/ExportLink";
import { formatDate, formatINR } from "@/lib/format";

type Sheet = { id: string; code: string; name: string; trade: string; wageType: string; daysPresent: number; hours: number; otHours: number; gross: number; advances: number; net: number; status: string; periodEnd: string };

export function WagesBoard({ siteId, period, start, end, sheets }: { siteId: string; period: "WEEKLY" | "MONTHLY"; start: string; end: string; sheets: Sheet[] }) {
  const router = useRouter();
  const { busy, submit } = useSubmit();
  const totals = sheets.reduce((a, s) => ({ gross: a.gross + s.gross, adv: a.adv + s.advances, net: a.net + s.net }), { gross: 0, adv: 0, net: 0 });
  const nav = (p: string, s: string) => router.push(`/wages?period=${p}&start=${s}`);
  const shiftPeriod = (dir: -1 | 1) => {
    const d = new Date(start + "T00:00:00Z");
    if (period === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + dir);
    else d.setUTCDate(d.getUTCDate() + 7 * dir);
    nav(period, d.toISOString().slice(0, 10));
  };
  return (
    <div>
      <PageHeader title="Wage sheets" hi="मज़दूरी शीट" back="/more" action={<ExportLink href={`/api/wages/export?siteId=${siteId}&period=${period}&start=${start}`} />} />
      <div className="mb-3 flex gap-2 text-sm font-semibold">
        <button onClick={() => nav("MONTHLY", start.slice(0, 8) + "01")} className={`rounded-full px-3 py-1.5 ${period === "MONTHLY" ? "bg-brand text-white" : "bg-white"}`}>Monthly</button>
        <button onClick={() => nav("WEEKLY", start)} className={`rounded-full px-3 py-1.5 ${period === "WEEKLY" ? "bg-brand text-white" : "bg-white"}`}>Weekly</button>
      </div>
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm">
        <button onClick={() => shiftPeriod(-1)} className="h-11 w-11 rounded-xl bg-slate-100 text-lg font-bold">‹</button>
        <div className="text-sm font-bold">{formatDate(start)} → {formatDate(end)}</div>
        <button onClick={() => shiftPeriod(1)} className="h-11 w-11 rounded-xl bg-slate-100 text-lg font-bold">›</button>
      </div>
      <Button full size="lg" className="mb-4" loading={busy} onClick={() => submit(() => api(`/api/wages/generate?siteId=${siteId}`, { body: { period, start } }))}>
        ⟳ {sheets.length ? "Re-generate from attendance" : "Generate wage sheets"}
      </Button>
      {sheets.length > 0 && (
        <>
          <Card className="mb-3">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><div className="text-xs text-slate-500">Gross</div><b>{formatINR(totals.gross)}</b></div>
              <div><div className="text-xs text-slate-500">Advances</div><b className="text-red-600">−{formatINR(totals.adv)}</b></div>
              <div><div className="text-xs text-slate-500">Net payable</div><b className="text-green-700">{formatINR(totals.net)}</b></div>
            </div>
          </Card>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Worker</th><th className="text-right">Days</th><th className="text-right">OT</th><th className="text-right">Gross</th><th className="text-right">Adv</th><th className="text-right">Net</th><th></th></tr></thead>
                <tbody>
                  {sheets.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="py-1.5">{s.code} {s.name}</td>
                      <td className="text-right">{s.daysPresent}</td>
                      <td className="text-right">{s.otHours}</td>
                      <td className="text-right">{formatINR(s.gross)}</td>
                      <td className="text-right text-red-600">{s.advances ? formatINR(s.advances) : "—"}</td>
                      <td className="text-right font-bold">{formatINR(s.net)}</td>
                      <td className="pl-2">
                        {s.status === "PAID" ? (
                          <Badge tone="green">Paid</Badge>
                        ) : (
                          <button disabled={busy} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold" onClick={() => submit(() => api(`/api/wages/${s.id}/paid`, { method: "POST", body: {} }))}>
                            {s.status === "DRAFT" ? "Finalize" : "Mark paid"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">Finalized/paid sheets are not touched by re-generate. Only you can see this screen.</p>
          </Card>
        </>
      )}
    </div>
  );
}
