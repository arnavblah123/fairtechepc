"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";

export function LoginForm({ next }: { next?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { username, password } });
      // Full navigation so the middleware sees the new cookie.
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
      <Input label="Username" hi="यूज़रनेम" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required autoFocus />
      <Input label="Password" hi="पासवर्ड" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" size="lg" full loading={busy}>
        <Bi en="Login" hi="लॉगिन करें" />
      </Button>
      <p className="text-center text-xs text-slate-500">Forgot password? Ask Arnav / पासवर्ड भूल गए? अरनव से पूछें</p>
    </form>
  );
}
