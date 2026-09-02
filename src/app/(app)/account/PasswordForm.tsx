"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const { busy, submit } = useSubmit();
  const mismatch = again.length > 0 && next !== again;

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (mismatch) return;
          const r = await submit(() => api("/api/auth/password", { body: { currentPassword: current, newPassword: next } }), { to: "/more" });
          if (r) {
            setCurrent("");
            setNext("");
            setAgain("");
          }
        }}
      >
        <Input label="Current password" hi="पुराना पासवर्ड" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        <Input label="New password" hi="नया पासवर्ड" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} autoComplete="new-password" />
        <Input label="Repeat new password" hi="फिर से नया पासवर्ड" type="password" value={again} onChange={(e) => setAgain(e.target.value)} required error={mismatch ? "Passwords do not match" : undefined} autoComplete="new-password" />
        <Button type="submit" size="lg" full loading={busy} disabled={mismatch}>
          <Bi en="Save" hi="सेव करें" />
        </Button>
      </form>
    </Card>
  );
}
