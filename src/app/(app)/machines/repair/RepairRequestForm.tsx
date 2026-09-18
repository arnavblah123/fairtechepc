"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card, EmptyState } from "@/components/ui/Card";
import { formatDate, titleCase } from "@/lib/format";

type Machine = { id: string; label: string; status: string; openTicket: { id: string; problem: string; raisedOn: string } | null };

/**
 * One-tap breakdown request from the supervisor's home screen: pick the machine,
 * say what is wrong, done. Machines that already have an open ticket are shown
 * as such instead of letting a second ticket be raised.
 */
export function RepairRequestForm({ machines, today }: { machines: Machine[]; today: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const { busy, submit } = useSubmit();
  const available = machines.filter((m) => !m.openTicket);
  const broken = machines.filter((m) => m.openTicket);

  if (machines.length === 0) {
    return <EmptyState en="No machines at this site yet." hi="अभी कोई मशीन नहीं है।" />;
  }

  const machine = machines.find((m) => m.id === picked);

  return (
    <div className="space-y-4">
      {machine ? (
        <Card title={machine.label} hi="क्या खराबी है?">
          <div className="space-y-3">
            <Textarea
              label="What is the problem?"
              hi="क्या खराबी है?"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={4}
              required
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setPicked(null); setProblem(""); }}>
                Back
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={busy}
                disabled={problem.trim().length < 5}
                onClick={() => submit(() => api(`/api/machines/${machine.id}/tickets`, { body: { problem, raisedOn: today } }), { to: `/machines/${machine.id}` })}
              >
                ⚠ <Bi en="Send" hi="भेजें" />
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            <Bi en="Pick the machine that is not working. Arnav sees it right away." hi="जो मशीन खराब है उसे चुनें। अरनव को तुरंत पता चलेगा।" />
          </p>
          <Card title="Pick a machine" hi="मशीन चुनें">
            <ul className="divide-y">
              {available.map((m) => (
                <li key={m.id}>
                  <button onClick={() => setPicked(m.id)} className="flex min-h-[56px] w-full items-center justify-between gap-2 py-2 text-left">
                    <span className="min-w-0 flex-1 truncate font-semibold">{m.label}</span>
                    <Badge tone={m.status === "RUNNING" ? "green" : "slate"}>{titleCase(m.status)}</Badge>
                  </button>
                </li>
              ))}
              {available.length === 0 && <li className="py-3 text-sm text-slate-500">Every machine already has an open repair ticket.</li>}
            </ul>
          </Card>
        </>
      )}

      {broken.length > 0 && (
        <Card title="Already reported" hi="पहले से दर्ज">
          <ul className="divide-y text-sm">
            {broken.map((m) => (
              <li key={m.id} className="py-2">
                <div className="font-semibold">{m.label}</div>
                <div className="text-xs text-slate-500">{m.openTicket!.problem} · since {formatDate(m.openTicket!.raisedOn)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
