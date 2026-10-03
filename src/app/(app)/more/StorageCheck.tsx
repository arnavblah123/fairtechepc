"use client";
import { useState } from "react";

type Result = { ok: boolean; message: string; tokenPresent: boolean; deployment: string | null; env: string; photosStored: number };

/** Superadmin-only: one tap tells whether the running deployment can store photos. */
export function StorageCheck({ tokenPresent, tokenName }: { tokenPresent: boolean; tokenName: string | null }) {
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await fetch("/api/uploads", { credentials: "same-origin" });
      const data = (await r.json().catch(() => ({}))) as Partial<Result> & { error?: string };
      setRes({
        ok: r.ok && !!data.ok,
        message: data.message ?? data.error ?? "Could not run the test",
        tokenPresent: !!(data as { credsPresent?: boolean }).credsPresent,
        deployment: data.deployment ?? null,
        env: data.env ?? "?",
        photosStored: data.photosStored ?? 0,
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Photo storage / फोटो स्टोरेज</div>
          <div className={tokenPresent ? "text-green-700" : "text-red-600"}>
            {tokenPresent ? `Store connected to this deployment (${tokenName})` : "No Blob store connected to this deployment"}
          </div>
        </div>
        <button type="button" onClick={run} disabled={busy} className="rounded-xl border-2 border-slate-300 px-3 py-2 font-semibold disabled:opacity-50">
          {busy ? "Testing…" : "Test"}
        </button>
      </div>
      {res && (
        <div className={`mt-2 rounded-lg p-2 ${res.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          <div className="font-semibold">{res.ok ? "Working" : "Not working"}</div>
          <div>{res.message}</div>
          <div className="mt-1 text-xs opacity-80">
            Deployment {res.deployment ?? "local"} · {res.env} · {res.photosStored} photos stored so far
          </div>
        </div>
      )}
      {!tokenPresent && (
        <p className="mt-2 text-xs text-slate-500">
          In Vercel: Storage → open the Blob store → Projects (left menu) → Connect this project with Production ticked → Deployments → Redeploy. The connection only reaches the app on a new deploy.
        </p>
      )}
    </div>
  );
}
