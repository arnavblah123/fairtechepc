"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Bi } from "@/components/ui/Bi";
import type { DeletableEntity } from "@/lib/deletable";

/**
 * Superadmin delete for any record. Asks for a reason, never hard-deletes,
 * always writes to the audit log. Callers must already have checked the role.
 */
export function DeleteButton({
  entity,
  id,
  what,
  to,
  full,
  size = "sm",
  label,
  icon,
}: {
  entity: DeletableEntity;
  id: string;
  what: string;
  to?: string;
  full?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
  /** Compact bin icon, for tight rows next to an Edit button. */
  icon?: boolean;
}) {
  const { busy, submit } = useSubmit();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    if (icon) {
      return (
        <button
          type="button"
          aria-label={`Delete ${what}`}
          onClick={() => setConfirming(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-red-200 text-lg text-red-600"
        >
          🗑
        </button>
      );
    }
    return (
      <Button variant="outline" size={size} full={full} className="!border-red-300 text-red-600" onClick={() => setConfirming(true)}>
        🗑 {label ?? <Bi en="Delete" hi="हटाएँ" inline />}
      </Button>
    );
  }
  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3">
      <p className="mb-2 text-sm font-semibold text-red-800">
        Delete {what}? It is kept in the audit log, not erased.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="flex-1"
          loading={busy}
          onClick={() => {
            const reason = window.prompt(`Why are you deleting ${what}?`);
            if (!reason || reason.trim().length < 3) return;
            submit(() => api("/api/records", { body: { entity, id, reason } }), to ? { to } : undefined);
          }}
        >
          Yes, delete
        </Button>
      </div>
    </div>
  );
}
