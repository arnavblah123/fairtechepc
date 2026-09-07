"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";

export function IssueActions({ issueId, status, canAck, canResolve }: { issueId: string; status: string; canAck: boolean; canResolve: boolean }) {
  const [note, setNote] = useState("");
  const { busy, submit } = useSubmit();
  const act = (action: string) => submit(() => api(`/api/issues/${issueId}`, { method: "PATCH", body: { action, note } }));
  if (!canAck && !canResolve) return null;
  return (
    <Card title="Actions" hi="कार्रवाई">
      <div className="space-y-3">
        {canAck && status === "OPEN" && (
          <Button full variant="secondary" loading={busy} onClick={() => act("ACKNOWLEDGE")}>
            <Bi en="Acknowledge (seen it)" hi="देख लिया" />
          </Button>
        )}
        {canResolve && status !== "IN_PROGRESS" && (
          <Button full variant="outline" loading={busy} onClick={() => act("IN_PROGRESS")}>
            <Bi en="Mark in progress" hi="काम चालू है" />
          </Button>
        )}
        {canResolve && (
          <>
            <Textarea label="Resolution note (required to resolve)" hi="क्या किया गया?" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button full variant="success" loading={busy} disabled={!note.trim()} onClick={() => act("RESOLVE")}>
              <Bi en="Mark resolved" hi="हल हो गया" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
