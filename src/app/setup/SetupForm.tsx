"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export function SetupForm() {
  const [name, setName] = useState("Arnav Bansal");
  const [username, setUsername] = useState("arnav");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteCity, setSiteCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = again.length > 0 && password !== again;

  return (
    <form
      className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl"
      onSubmit={async (e) => {
        e.preventDefault();
        if (mismatch) return;
        setBusy(true);
        setError(null);
        try {
          await api("/api/setup", { body: { name, username, password, siteName, siteCity } });
          window.location.href = "/";
        } catch (err) {
          setError(err instanceof Error ? err.message : "Setup failed");
          setBusy(false);
        }
      }}
    >
      <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" required hint="Lowercase letters and numbers" />
      <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
      <Input label="Repeat password" type="password" value={again} onChange={(e) => setAgain(e.target.value)} required error={mismatch ? "Passwords do not match" : undefined} autoComplete="new-password" />
      <div className="space-y-3 rounded-xl bg-blue-50 p-3">
        <p className="text-sm font-semibold text-blue-900">Your site</p>
        <Input label="Site name" value={siteName} onChange={(e) => setSiteName(e.target.value)} required placeholder="e.g. Jamshedpur Fabrication Yard" />
        <Input label="City" value={siteCity} onChange={(e) => setSiteCity(e.target.value)} required />
        <p className="text-xs text-blue-900/70">Job numbers take their prefix from the site name. You can rename the site later.</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" size="lg" full loading={busy} disabled={mismatch}>
        Create account and start
      </Button>
    </form>
  );
}
