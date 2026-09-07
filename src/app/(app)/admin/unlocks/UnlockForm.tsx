"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";

const MODULES = [
  ["ATTENDANCE", "Attendance / हाज़िरी"],
  ["CONSUMPTION", "Consumables / कंज़्यूमेबल"],
  ["PHOTOS", "Photos / फोटो"],
  ["EXPENSES", "Expenses / खर्च"],
  ["STAGE_PROGRESS", "Stage progress / स्टेज प्रगति"],
] as const;

export function UnlockForm({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [module, setModule] = useState<string>("ATTENDANCE");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const { busy, submit } = useSubmit();
  return (
    <Card title={`Unlock for ${siteName}`} hi="अनलॉक करें">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await submit(() => api("/api/unlocks", { body: { siteId, module, date, reason } }));
          if (r) {
            setDate("");
            setReason("");
          }
        }}
      >
        <Select label="Module" hi="मॉड्यूल" value={module} onChange={(e) => setModule(e.target.value)}>
          {MODULES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input label="Date to unlock" hi="तारीख़" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Input label="Reason" hi="कारण" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} hint="Valid for 24 hours. Kept in the audit log." />
        <Button type="submit" full loading={busy}>
          <Bi en="Unlock for 24 hours" hi="24 घंटे के लिए खोलें" />
        </Button>
      </form>
    </Card>
  );
}
