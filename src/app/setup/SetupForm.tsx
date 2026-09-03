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
  const [sampleData, setSampleData] = useState(true);
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
          await api("/api/setup", { body: { name, username, password, sampleData } });
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
      <label className="flex items-start gap-3 rounded-xl bg-blue-50 p-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5" checked={sampleData} onChange={(e) => setSampleData(e.target.checked)} />
        <span>
          Add sample data to explore: one site, a job with 8 stages, 15 workers, and two test logins (<b>incharge</b> / <b>supervisor</b>, password <b>site123</b>). The consumable item master is always added.
        </span>
      </label>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" size="lg" full loading={busy} disabled={mismatch}>
        Create account and start
      </Button>
    </form>
  );
}
