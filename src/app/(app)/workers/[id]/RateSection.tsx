"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { formatDate, formatINR } from "@/lib/format";

type Rate = { id: string; rate: number; otRate: number | null; effectiveFrom: string; setBy: string };

export function RateSection({ workerId, wageType, rates }: { workerId: string; wageType: string; rates: Rate[] }) {
  const [rate, setRate] = useState("");
  const [otRate, setOtRate] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const { busy, submit } = useSubmit();
  const unit = wageType === "PER_DAY" ? "per day" : "per hour";
  return (
    <Card title="Wage rate (only you can see this)" hi="मज़दूरी दर">
      <form
        className="grid grid-cols-3 items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await submit(() => api(`/api/workers/${workerId}/rate`, { body: { rate: Number(rate), otRate: otRate ? Number(otRate) : null, effectiveFrom: from } }));
          if (r) {
            setRate("");
            setOtRate("");
          }
        }}
      >
        <Input label={`Rate (₹ ${unit})`} value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" required />
        <Input label="OT ₹/hr" value={otRate} onChange={(e) => setOtRate(e.target.value)} inputMode="decimal" hint="Blank = 1.5×" />
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
        <div className="col-span-3">
          <Button type="submit" full loading={busy}>
            Set new rate
          </Button>
        </div>
      </form>
      {rates.length > 0 && (
        <ul className="mt-3 divide-y text-sm">
          {rates.map((r) => (
            <li key={r.id} className="flex justify-between py-1.5">
              <span>
                {formatINR(r.rate)} {unit}
                {r.otRate ? ` · OT ${formatINR(r.otRate)}/hr` : ""}
              </span>
              <span className="text-slate-500">from {formatDate(r.effectiveFrom)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
