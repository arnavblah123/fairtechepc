"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [password, setPassword] = useState("");
  const { busy, submit } = useSubmit();
  return (
    <Card title="Reset password" hi="पासवर्ड रीसेट">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await submit(() => api(`/api/users/${userId}/reset-password`, { body: { password } }));
          if (r) setPassword("");
        }}
      >
        <Input label="New password" hi="नया पासवर्ड" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} hint="The user is logged out of all phones after reset." />
        <Button type="submit" variant="secondary" full loading={busy}>
          <Bi en="Set new password" hi="नया पासवर्ड लगाएँ" />
        </Button>
      </form>
    </Card>
  );
}
