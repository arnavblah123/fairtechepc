"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card } from "@/components/ui/Card";
import { CameraInput } from "@/components/forms/CameraInput";
import { PhotoLink } from "@/components/forms/PhotoLink";
import { formatDate } from "@/lib/format";

type Dispatch = { id: string; item: string; unit: string; qty: number; date: string; photoUrl: string | null; received: { qty: number; by: string; short: boolean; remark: string | null } | null };

export function DispatchBoard({ siteId, canDispatch, canReceive, items, dispatches }: {
  siteId: string; canDispatch: boolean; canReceive: boolean;
  items: { id: string; name: string; unit: string }[]; dispatches: Dispatch[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [photo, setPhoto] = useState("");
  const [recv, setRecv] = useState<Record<string, string>>({});
  const [recvRemark, setRecvRemark] = useState<Record<string, string>>({});
  const { busy, submit } = useSubmit();

  return (
    <div className="space-y-4">
      {canDispatch && (showNew ? (
        <Card title="Record dispatch from factory" hi="फैक्ट्री से भेजा">
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            const r = await submit(() => api("/api/consumables/dispatches", { body: { siteId, itemId, qty: Number(qty), dispatchDate: date, photoUrl: photo } }));
            if (r) { setShowNew(false); setQty(""); setPhoto(""); }
          }}>
            <Select label="Item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
              {items.map((i) => (<option key={i.id} value={i.id}>{i.name} ({i.unit})</option>))}
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" required />
              <Input label="Dispatch date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <CameraInput label="Consignment photo (optional)" requireGeo={false} preview={photo || null} onCaptured={(p) => setPhoto(p.url)} />
            <Button type="submit" full loading={busy}>Save dispatch</Button>
          </form>
        </Card>
      ) : (
        <Button full size="lg" onClick={() => setShowNew(true)}>+ <Bi en="New dispatch" hi="नया डिस्पैच" /></Button>
      ))}
      <Card>
        <ul className="divide-y">
          {dispatches.map((d) => (
            <li key={d.id} className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{d.item} · {d.qty} {d.unit}</span>
                {d.received ? (
                  d.received.short ? <Badge tone="red">Short: got {d.received.qty}</Badge> : <Badge tone="green">Received {d.received.qty}</Badge>
                ) : (
                  <Badge tone="amber">In transit</Badge>
                )}
              </div>
              <div className="text-xs text-slate-500">Sent {formatDate(d.date)} {d.received ? `· ack by ${d.received.by}` : ""} {d.received?.remark ? `· ${d.received.remark}` : ""}</div>
              <PhotoLink url={d.photoUrl} size="h-12 w-12" />
              {canReceive && !d.received && (
                <div className="mt-2 flex items-end gap-2">
                  <Input label="Actual received qty" hi="कितना मिला" value={recv[d.id] ?? String(d.qty)} onChange={(e) => setRecv({ ...recv, [d.id]: e.target.value })} inputMode="decimal" />
                  <Button loading={busy} onClick={() => {
                    const q = Number(recv[d.id] ?? d.qty);
                    let remark = recvRemark[d.id] ?? "";
                    if (q < d.qty && !remark) {
                      remark = window.prompt("Received less than sent. What is short / why?") ?? "";
                      if (!remark.trim()) return;
                      setRecvRemark({ ...recvRemark, [d.id]: remark });
                    }
                    submit(() => api(`/api/consumables/dispatches/${d.id}/receive`, { body: { receivedQty: q, remark } }));
                  }}>
                    ✓ <Bi en="Receive" hi="मिला" />
                  </Button>
                </div>
              )}
            </li>
          ))}
          {dispatches.length === 0 && <li className="py-3 text-sm text-slate-500">No dispatches yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
