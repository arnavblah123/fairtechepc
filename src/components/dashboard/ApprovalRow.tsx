"use client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import type { ReactNode } from "react";

/** One-tap approve/reject row used on the superadmin dashboard. */
export function ApprovalRow({ label, sub, endpoint, extraApprove, children }: {
  label: ReactNode; sub: string; endpoint: string;
  extraApprove?: { label: string; body: Record<string, unknown> }[];
  children?: ReactNode;
}) {
  const { busy, submit } = useSubmit();
  return (
    <li className="py-2">
      <div className="font-semibold">{label}</div>
      <div className="text-xs text-slate-500">{sub}</div>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {(extraApprove ?? [{ label: "✓ Approve", body: { decision: "APPROVED" } }]).map((a) => (
          <Button key={a.label} size="sm" variant="success" loading={busy} onClick={() => submit(() => api(endpoint, { body: a.body }))}>
            {a.label}
          </Button>
        ))}
        <Button size="sm" variant="danger" loading={busy} onClick={() => {
          const note = window.prompt("Reason for rejection?") ?? "";
          if (note.trim()) submit(() => api(endpoint, { body: { decision: "REJECTED", note } }));
        }}>
          ✕ Reject
        </Button>
        {children}
      </div>
    </li>
  );
}
