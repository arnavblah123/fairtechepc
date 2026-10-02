"use client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";

export function ClearWorkersButton({ siteId, count }: { siteId: string; count: number }) {
  const { busy, submit } = useSubmit();
  if (count === 0) return null;
  return (
    <Button
      variant="outline"
      full
      size="sm"
      className="!border-red-300 text-red-600"
      loading={busy}
      onClick={() => {
        const reason = window.prompt(`Remove all ${count} workers from the active list? They are kept in records and can be brought back one by one. Reason:`);
        if (reason && reason.trim().length >= 3) submit(() => api(`/api/workers/clear?siteId=${siteId}`, { body: { reason } }));
      }}
    >
      🗑 Remove all {count} workers (sample list)
    </Button>
  );
}
