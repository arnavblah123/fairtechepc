"use client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Bi } from "@/components/ui/Bi";

export function VoidJobButton({ jobId }: { jobId: string }) {
  const { busy, submit } = useSubmit();
  return (
    <Button
      variant="outline"
      full
      loading={busy}
      className="text-red-600"
      onClick={() => {
        const reason = window.prompt("Reason for cancelling this job? (kept in the audit log)");
        if (!reason || reason.trim().length < 3) return;
        submit(() => api(`/api/jobs/${jobId}/void`, { body: { reason } }), { to: "/jobs" });
      }}
    >
      <Bi en="Cancel this job" hi="यह काम रद्द करें" />
    </Button>
  );
}
