"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { CameraInput } from "@/components/forms/CameraInput";

type OpenTicket = { id: string; problem: string; status: string; repairType: string | null; repairedBy: string; repairCost: number | null; downtimeDays: number | null; parts: { item: string; qty: number; price: number }[] };

export function MachinePanel({
  machine, isAdmin, canTicket, canSendBack, sites, openTicket, openDispatch,
}: {
  machine: { id: string; status: string; siteId: string | null; siteName: string | null };
  isAdmin: boolean; canTicket: boolean; canSendBack: boolean;
  sites: { id: string; name: string }[];
  openTicket: OpenTicket | null;
  openDispatch: { id: string; direction: string; canAck: boolean } | null;
}) {
  const { busy, submit } = useSubmit();
  const [mode, setMode] = useState<"none" | "ticket" | "toSite" | "toFactory" | "repair">("none");
  const today = new Date().toISOString().slice(0, 10);
  // shared form state
  const [text, setText] = useState("");
  const [condition, setCondition] = useState("GOOD");
  const [photo, setPhoto] = useState("");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [repairType, setRepairType] = useState(openTicket?.repairType ?? "IN_HOUSE");
  const [repairedBy, setRepairedBy] = useState(openTicket?.repairedBy ?? "");
  const [cost, setCost] = useState(openTicket?.repairCost !== null && openTicket ? String(openTicket.repairCost) : "");
  const [downtime, setDowntime] = useState(openTicket?.downtimeDays !== null && openTicket ? String(openTicket.downtimeDays) : "");
  const [parts, setParts] = useState<{ item: string; qty: number; price: number }[]>(openTicket?.parts ?? []);
  const [note, setNote] = useState("");

  if (openDispatch) {
    return (
      <Card title={openDispatch.direction === "TO_SITE" ? "Machine in transit to site" : "Machine on its way back to factory"} hi="रास्ते में">
        {openDispatch.canAck ? (
          <div className="space-y-3">
            <Select label="Condition on arrival" hi="हालत" value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="GOOD">Good / ठीक</option>
              <option value="AVERAGE">Average / साधारण</option>
              <option value="NEEDS_REPAIR">Needs repair / मरम्मत चाहिए</option>
            </Select>
            <CameraInput label="Arrival photo" hi="फोटो" requireGeo={false} preview={photo || null} onCaptured={(p) => setPhoto(p.url)} />
            <Button full loading={busy} onClick={() => submit(() => api(`/api/machine-dispatches/${openDispatch.id}/receive`, { body: { condition, photoUrl: photo } }))}>
              ✓ <Bi en="Acknowledge received" hi="मिल गई" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Waiting for the other side to acknowledge receipt.</p>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {openTicket && (
        <Card title="Open breakdown ticket" hi="खुला टिकट">
          <p className="text-sm">{openTicket.problem}</p>
          {canTicket && mode !== "repair" && (
            <Button full variant="secondary" className="mt-3" onClick={() => setMode("repair")}>
              <Bi en="Update repair / sign off" hi="मरम्मत अपडेट करें" />
            </Button>
          )}
          {mode === "repair" && (
            <div className="mt-3 space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-2">
                <Select label="Repair type" value={repairType ?? "IN_HOUSE"} onChange={(e) => setRepairType(e.target.value)}>
                  <option value="IN_HOUSE">In-house</option>
                  <option value="SENT_OUT">Sent out</option>
                </Select>
                <Input label="Repaired by" value={repairedBy} onChange={(e) => setRepairedBy(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Repair cost ₹" value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" />
                <Input label="Downtime days" value={downtime} onChange={(e) => setDowntime(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold">Spare parts</div>
                {parts.map((p, i) => (
                  <div key={i} className="mb-1 flex gap-1">
                    <input className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 p-2 text-sm" placeholder="Part" value={p.item} onChange={(e) => setParts(parts.map((x, j) => j === i ? { ...x, item: e.target.value } : x))} />
                    <input className="w-14 rounded-lg border-2 border-slate-300 p-2 text-sm" type="number" value={p.qty} onChange={(e) => setParts(parts.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
                    <input className="w-20 rounded-lg border-2 border-slate-300 p-2 text-sm" type="number" placeholder="₹" value={p.price} onChange={(e) => setParts(parts.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} />
                    <button className="px-1 text-red-600" onClick={() => setParts(parts.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                <button className="text-sm font-semibold text-brand" onClick={() => setParts([...parts, { item: "", qty: 1, price: 0 }])}>+ part</button>
              </div>
              <Button full variant="outline" loading={busy} onClick={() =>
                submit(() => api(`/api/tickets/${openTicket.id}`, { method: "PATCH", body: { repairType, repairedBy, repairCost: cost ? Number(cost) : null, downtimeDays: downtime ? Number(downtime) : null, parts: parts.filter((p) => p.item.trim()) } }))
              }>
                Save details (still open)
              </Button>
              <Textarea label="Sign-off: who verified the repair and how? (required to close)" hi="किसने जाँचा?" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button full variant="success" loading={busy} disabled={!note.trim()} onClick={() =>
                submit(() => api(`/api/tickets/${openTicket.id}`, { method: "PATCH", body: { repairType, repairedBy, repairCost: cost ? Number(cost) : null, downtimeDays: downtime ? Number(downtime) : null, parts: parts.filter((p) => p.item.trim()), resolve: true, verificationNote: note } }))
              }>
                ✓ <Bi en="Repair verified — close ticket" hi="जाँच हो गई — बंद करें" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {machine.siteId && canTicket && !openTicket && (
        <>
          <Card title="Machine status" hi="मशीन स्थिति">
            <div className="grid grid-cols-3 gap-2">
              {(["RUNNING", "IDLE", "UNDER_REPAIR"] as const).map((s) => (
                <Button key={s} variant={machine.status === s ? (s === "RUNNING" ? "success" : s === "UNDER_REPAIR" ? "danger" : "secondary") : "outline"} loading={busy}
                  onClick={() => submit(() => api(`/api/machines/${machine.id}/status`, { body: { status: s } }))}>
                  {s === "RUNNING" ? "Running" : s === "IDLE" ? "Idle" : "Repair"}
                </Button>
              ))}
            </div>
          </Card>
          {mode === "ticket" ? (
            <Card title="Breakdown ticket" hi="खराबी टिकट">
              <div className="space-y-3">
                <Textarea label="What is the problem?" hi="क्या खराबी है?" value={text} onChange={(e) => setText(e.target.value)} required />
                <Button full variant="danger" loading={busy} disabled={text.trim().length < 5} onClick={() => submit(() => api(`/api/machines/${machine.id}/tickets`, { body: { problem: text, raisedOn: today } }))}>
                  ⚠ <Bi en="Raise breakdown ticket" hi="टिकट बनाएँ" />
                </Button>
              </div>
            </Card>
          ) : (
            <Button full variant="outline" onClick={() => setMode("ticket")}>⚠ <Bi en="Report breakdown" hi="खराबी बताएँ" /></Button>
          )}
        </>
      )}

      {isAdmin && !machine.siteId && (
        mode === "toSite" ? (
          <Card title="Dispatch to site" hi="साइट भेजें">
            <div className="space-y-3">
              <Select label="Site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                {sites.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </Select>
              <Select label="Condition on dispatch" value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="GOOD">Good</option><option value="AVERAGE">Average</option><option value="NEEDS_REPAIR">Needs repair</option>
              </Select>
              <CameraInput label="Dispatch photo" requireGeo={false} preview={photo || null} onCaptured={(p) => setPhoto(p.url)} />
              <Button full loading={busy} onClick={() => submit(() => api(`/api/machines/${machine.id}/dispatch`, { body: { direction: "TO_SITE", siteId, dispatchDate: today, condition, photoUrl: photo } }))}>
                Send to site
              </Button>
            </div>
          </Card>
        ) : (
          <Button full onClick={() => setMode("toSite")}>→ Dispatch to site</Button>
        )
      )}

      {canSendBack && machine.siteId && !openTicket && (
        mode === "toFactory" ? (
          <Card title="Return to factory" hi="फैक्ट्री वापस">
            <div className="space-y-3">
              <Select label="Condition" value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="GOOD">Good</option><option value="AVERAGE">Average</option><option value="NEEDS_REPAIR">Needs repair</option>
              </Select>
              <CameraInput label="Photo before sending" requireGeo={false} preview={photo || null} onCaptured={(p) => setPhoto(p.url)} />
              <Button full loading={busy} onClick={() => submit(() => api(`/api/machines/${machine.id}/dispatch`, { body: { direction: "TO_FACTORY", siteId: machine.siteId, dispatchDate: today, condition, photoUrl: photo } }))}>
                Send back to factory
              </Button>
            </div>
          </Card>
        ) : (
          <Button full variant="outline" onClick={() => setMode("toFactory")}>← <Bi en="Return to factory" hi="फैक्ट्री वापस भेजें" /></Button>
        )
      )}
    </div>
  );
}
