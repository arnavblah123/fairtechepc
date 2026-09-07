"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card } from "@/components/ui/Card";
import { CameraInput } from "@/components/forms/CameraInput";
import { formatDate, formatINR } from "@/lib/format";

type Req = { id: string; item: string; unit: string; qty: number; reason: string; neededBy: string; status: string; fulfilment: string | null; by: string; decidedBy: string | null; note: string | null; price: number | null };
const TONE = { PENDING: "amber", APPROVED: "blue", REJECTED: "red", FULFILLED: "green" } as const;

export function RequestsBoard({ siteId, canRequest, canApprove, canClose, items, requests }: {
  siteId: string; canRequest: boolean; canApprove: boolean; canClose: boolean;
  items: { id: string; name: string; unit: string }[]; requests: Req[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [closing, setClosing] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [bill, setBill] = useState("");
  const { busy, submit } = useSubmit();

  return (
    <div className="space-y-4">
      {canRequest && (
        showNew ? (
          <Card title="New request" hi="नई रिक्वेस्ट">
            <form className="space-y-3" onSubmit={async (e) => {
              e.preventDefault();
              const r = await submit(() => api(`/api/consumables/requests?siteId=${siteId}`, { body: { itemId, qty: Number(qty), reason, neededBy } }));
              if (r) { setShowNew(false); setQty(""); setReason(""); setNeededBy(""); }
            }}>
              <Select label="Item" hi="सामान" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                {items.map((i) => (<option key={i.id} value={i.id}>{i.name} ({i.unit})</option>))}
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Quantity" hi="मात्रा" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" required />
                <Input label="Needed by" hi="कब तक चाहिए" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} required />
              </div>
              <Input label="Reason" hi="कारण" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
              <Button type="submit" full loading={busy}><Bi en="Send request" hi="रिक्वेस्ट भेजें" /></Button>
            </form>
          </Card>
        ) : (
          <Button full size="lg" onClick={() => setShowNew(true)}>+ <Bi en="Request material" hi="सामान माँगें" /></Button>
        )
      )}
      <Card>
        <ul className="divide-y">
          {requests.map((r) => (
            <li key={r.id} className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{r.item} · {r.qty} {r.unit}</span>
                <Badge tone={TONE[r.status as keyof typeof TONE]}>{r.status}{r.fulfilment === "LOCAL_PURCHASE" ? " · local buy" : r.fulfilment === "FROM_FACTORY" ? " · from factory" : ""}</Badge>
              </div>
              <div className="text-xs text-slate-500">{r.reason} · needed by {formatDate(r.neededBy)} · by {r.by}{r.decidedBy ? ` · decided by ${r.decidedBy}` : ""}{r.price !== null ? ` · bought for ${formatINR(r.price)}` : ""}</div>
              {r.note && <div className="text-xs text-slate-600">Note: {r.note}</div>}
              {canApprove && r.status === "PENDING" && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Button size="sm" variant="success" loading={busy} onClick={() => submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "APPROVED", fulfilment: "FROM_FACTORY" } }))}>
                    ✓ Factory
                  </Button>
                  <Button size="sm" variant="success" loading={busy} onClick={() => submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "APPROVED", fulfilment: "LOCAL_PURCHASE" } }))}>
                    ✓ Buy local
                  </Button>
                  <Button size="sm" variant="danger" loading={busy} onClick={() => {
                    const note = window.prompt("Reason for rejection?") ?? "";
                    if (note.trim()) submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "REJECTED", note } }));
                  }}>
                    ✕ Reject
                  </Button>
                </div>
              )}
              {canClose && r.status === "APPROVED" && r.fulfilment === "LOCAL_PURCHASE" && (
                closing === r.id ? (
                  <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
                    <Input label="Price paid (₹)" hi="कीमत" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required />
                    <CameraInput label="Bill photo (required)" hi="बिल फोटो" requireGeo={false} preview={bill || null} onCaptured={(p) => setBill(p.url)} />
                    <Button full loading={busy} disabled={!bill || !price} onClick={async () => {
                      const ok = await submit(() => api(`/api/consumables/requests/${r.id}/close`, { body: { price: Number(price), billPhotoUrl: bill } }));
                      if (ok) { setClosing(null); setPrice(""); setBill(""); }
                    }}>
                      <Bi en="Close purchase (posts to petty cash)" hi="खरीद बंद करें" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setClosing(r.id)}>
                    <Bi en="Bought it — enter bill" hi="खरीद लिया — बिल भरें" />
                  </Button>
                )
              )}
            </li>
          ))}
          {requests.length === 0 && <li className="py-3 text-sm text-slate-500">No requests yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
