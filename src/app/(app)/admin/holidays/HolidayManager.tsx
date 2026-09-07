"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";

export function HolidayManager({ siteId, holidays }: { siteId: string; holidays: { id: string; date: string; name: string }[] }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const { busy, submit } = useSubmit();
  return (
    <div className="space-y-4">
      <Card title="Add holiday" hi="छुट्टी जोड़ें">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await submit(() => api("/api/holidays", { body: { siteId, date, name } }));
            if (r) {
              setDate("");
              setName("");
            }
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Input label="Date" hi="तारीख़" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input label="Name" hi="नाम" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Diwali" />
          </div>
          <Button type="submit" full loading={busy}>
            Add
          </Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Holiday days auto-fill in attendance and are excluded from absent counts and wage-sheet absent days.</p>
      </Card>
      <Card title="Holiday list" hi="सूची">
        <ul className="divide-y">
          {holidays.map((h) => (
            <li key={h.id} className="flex min-h-[48px] items-center justify-between py-2">
              <span>
                <b>{formatDate(h.date)}</b> · {h.name}
              </span>
              <button
                onClick={() => {
                  if (window.confirm(`Remove holiday ${h.name}?`)) submit(() => api(`/api/holidays/${h.id}`, { method: "DELETE" }));
                }}
                className="min-h-[40px] px-2 font-semibold text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
          {holidays.length === 0 && <li className="py-2 text-sm text-slate-500">No holidays marked.</li>}
        </ul>
      </Card>
    </div>
  );
}
