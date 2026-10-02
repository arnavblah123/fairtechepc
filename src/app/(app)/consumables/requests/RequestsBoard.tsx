"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card } from "@/components/ui/Card";
import { CameraInput } from "@/components/forms/CameraInput";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { formatDate, formatINR } from "@/lib/format";

type Req = {
  id: string; item: string; unit: string; qty: number; reason: string; neededBy: string;
  status: string; fulfilment: string | null; by: string; decidedBy: string | null; note: string | null;
  price: number | null; vendor: string | null; poNumber: string | null; unitPrice: number | null;
  expectedDate: string | null; orderedBy: string | null; shipped: boolean; awaitingInward: boolean;
};
const TONE = { PENDING: "amber", APPROVED: "blue", ORDERED: "blue", REJECTED: "red", FULFILLED: "green" } as const;
const FULFILMENT_LABEL: Record<string, string> = {
  FROM_FACTORY: "from factory",
  PURCHASE_ORDER: "purchase order",
  LOCAL_PURCHASE: "local buy",
};

/**
 * The full purchase pipeline on one screen. Each role only sees the buttons for
 * its own step: site raises → Arnav approves → purchase (Pune) orders and ships
 * → site inwards and accepts.
 */
export function RequestsBoard({
  siteId, canRequest, canApprove, canOrder, canShip, canClose, canDelete, canPropose, items: initialItems, requests, openNew = false,
}: {
  siteId: string; canRequest: boolean; canApprove: boolean; canOrder: boolean; canShip: boolean; canClose: boolean; canDelete: boolean; canPropose: boolean; openNew?: boolean;
  items: { id: string; name: string; unit: string }[]; requests: Req[];
}) {
  const [items, setItems] = useState(initialItems);
  const [showNew, setShowNew] = useState(openNew && canRequest);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [proposing, setProposing] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("nos");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [panel, setPanel] = useState<{ id: string; kind: "order" | "ship" | "close" } | null>(null);
  const { busy, submit } = useSubmit();

  const step = (r: Req) => {
    if (r.status === "PENDING") return "Waiting for Arnav's approval";
    if (r.status === "APPROVED" && r.fulfilment === "LOCAL_PURCHASE") return "Site to buy locally and upload the bill";
    if (r.status === "APPROVED") return "Waiting for purchase (Pune) to place the order";
    if (r.status === "ORDERED" && !r.shipped) return "Ordered — waiting for dispatch";
    if (r.status === "ORDERED" && r.awaitingInward) return "In transit — site to inward and accept";
    if (r.status === "FULFILLED") return "Inwarded and accepted at site";
    return "";
  };

  return (
    <div className="space-y-4">
      {canRequest && (showNew ? (
        <Card title="New request" hi="नई रिक्वेस्ट">
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            const r = await submit(() => api(`/api/consumables/requests?siteId=${siteId}`, { body: { itemId, qty: Number(qty), reason, neededBy } }));
            if (r) { setShowNew(false); setQty(""); setReason(""); setNeededBy(""); }
          }}>
            <Select label="Item" hi="सामान" value={itemId} onChange={(e) => setItemId(e.target.value)}>
              {items.map((i) => (<option key={i.id} value={i.id}>{i.name} ({i.unit})</option>))}
            </Select>
            {canPropose && (proposing ? (
              <div className="space-y-2 rounded-xl bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900">
                  <Bi en="Add the missing item. Arnav will be asked to confirm it, but your request goes ahead now." hi="नया आइटम जोड़ें। अरनव बाद में पक्का करेंगे, पर रिक्वेस्ट अभी जाएगी।" />
                </p>
                <Input label="Item name" hi="आइटम का नाम" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
                <Input label="Unit" hi="इकाई" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} required placeholder="kg / nos / litre" />
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setProposing(false)}>Cancel</Button>
                  <Button type="button" size="sm" className="flex-1" loading={busy} disabled={newName.trim().length < 2} onClick={async () => {
                    const r = await submit(() => api<{ id: string; name: string; unit: string; existed: boolean }>(`/api/items/propose?siteId=${siteId}`, { body: { name: newName, unit: newUnit } }), { refresh: false });
                    if (r) {
                      if (!items.some((i) => i.id === r.id)) setItems([...items, { id: r.id, name: r.name, unit: r.unit }].sort((a, b) => a.name.localeCompare(b.name)));
                      setItemId(r.id);
                      setProposing(false);
                      setNewName("");
                    }
                  }}>
                    Add &amp; select
                  </Button>
                </div>
              </div>
            ) : (
              <button type="button" className="text-sm font-semibold text-brand" onClick={() => setProposing(true)}>
                + <Bi en="Item not in the list? Add it" hi="आइटम सूची में नहीं? जोड़ें" inline />
              </button>
            ))}
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
      ))}

      <Card>
        <ul className="divide-y">
          {requests.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 font-semibold">{r.item} · {r.qty} {r.unit}</span>
                <Badge tone={TONE[r.status as keyof typeof TONE]}>
                  {r.status}{r.fulfilment ? ` · ${FULFILMENT_LABEL[r.fulfilment]}` : ""}
                </Badge>
              </div>
              <div className="text-xs text-slate-500">
                {r.reason} · needed by {formatDate(r.neededBy)} · by {r.by}
                {r.decidedBy ? ` · approved by ${r.decidedBy}` : ""}
              </div>
              {r.vendor && (
                <div className="text-xs text-slate-600">
                  🧾 {r.vendor}{r.poNumber ? ` · PO ${r.poNumber}` : ""}{r.unitPrice !== null ? ` · ${formatINR(r.unitPrice)}/${r.unit}` : ""}
                  {r.expectedDate ? ` · due ${formatDate(r.expectedDate)}` : ""}{r.orderedBy ? ` · ${r.orderedBy}` : ""}
                </div>
              )}
              {r.price !== null && <div className="text-xs text-slate-600">Bought for {formatINR(r.price)}</div>}
              {r.note && <div className="text-xs text-slate-600">Note: {r.note}</div>}
              <div className="mt-1 text-xs font-semibold text-brand">{step(r)}</div>

              {canApprove && r.status === "PENDING" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button size="sm" variant="success" loading={busy} onClick={() => submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "APPROVED", fulfilment: "PURCHASE_ORDER" } }))}>✓ Purchase buys</Button>
                  <Button size="sm" variant="success" loading={busy} onClick={() => submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "APPROVED", fulfilment: "FROM_FACTORY" } }))}>✓ From factory</Button>
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "APPROVED", fulfilment: "LOCAL_PURCHASE" } }))}>✓ Site buys local</Button>
                  <Button size="sm" variant="danger" loading={busy} onClick={() => {
                    const note = window.prompt("Reason for rejection?") ?? "";
                    if (note.trim()) submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "REJECTED", note } }));
                  }}>✕ Reject</Button>
                </div>
              )}

              {canOrder && r.status === "APPROVED" && r.fulfilment !== "LOCAL_PURCHASE" && (
                panel?.id === r.id && panel.kind === "order" ? (
                  <OrderForm busy={busy} unit={r.unit} qty={r.qty} onCancel={() => setPanel(null)} onSave={async (body) => {
                    const ok = await submit(() => api(`/api/consumables/requests/${r.id}/order`, { body }));
                    if (ok) setPanel(null);
                  }} />
                ) : (
                  <Button size="sm" variant="primary" className="mt-2" onClick={() => setPanel({ id: r.id, kind: "order" })}>
                    <Bi en="Place order with vendor" hi="ऑर्डर करें" />
                  </Button>
                )
              )}

              {canShip && (r.status === "ORDERED" || (r.status === "APPROVED" && r.fulfilment === "FROM_FACTORY")) && !r.awaitingInward && (
                panel?.id === r.id && panel.kind === "ship" ? (
                  <ShipForm busy={busy} unit={r.unit} qty={r.qty} onCancel={() => setPanel(null)} onSave={async (body) => {
                    const ok = await submit(() => api(`/api/consumables/requests/${r.id}/ship`, { body }));
                    if (ok) setPanel(null);
                  }} />
                ) : (
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => setPanel({ id: r.id, kind: "ship" })}>
                    <Bi en="Dispatch to site" hi="साइट भेजें" />
                  </Button>
                )
              )}

              {r.awaitingInward && (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">
                  Material dispatched — the site inwards it on the Dispatches screen.
                </p>
              )}

              {canClose && r.status === "APPROVED" && r.fulfilment === "LOCAL_PURCHASE" && (
                panel?.id === r.id && panel.kind === "close" ? (
                  <CloseForm busy={busy} onCancel={() => setPanel(null)} onSave={async (body) => {
                    const ok = await submit(() => api(`/api/consumables/requests/${r.id}/close`, { body }));
                    if (ok) setPanel(null);
                  }} />
                ) : (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setPanel({ id: r.id, kind: "close" })}>
                    <Bi en="Bought it — enter bill" hi="खरीद लिया — बिल भरें" />
                  </Button>
                )
              )}

              {canDelete && (
                <div className="mt-2">
                  <DeleteButton entity="ConsumableRequest" id={r.id} what={`request for ${r.item}`} />
                </div>
              )}
            </li>
          ))}
          {requests.length === 0 && <li className="py-3 text-sm text-slate-500">No requests yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

function OrderForm({ busy, unit, qty, onSave, onCancel }: { busy: boolean; unit: string; qty: number; onSave: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [vendorName, setVendor] = useState("");
  const [poNumber, setPo] = useState("");
  const [unitPrice, setPrice] = useState("");
  const [expectedDate, setDate] = useState("");
  const [orderQty, setQty] = useState(String(qty));
  const [orderNote, setNote] = useState("");
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
      <Input label="Vendor" hi="विक्रेता" value={vendorName} onChange={(e) => setVendor(e.target.value)} required />
      <div className="grid grid-cols-2 gap-2">
        <Input label="PO number" value={poNumber} onChange={(e) => setPo(e.target.value)} />
        <Input label={`Rate ₹ / ${unit}`} value={unitPrice} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label={`Order qty (${unit})`} value={orderQty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
        <Input label="Expected date" type="date" value={expectedDate} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <Input label="Note" value={orderNote} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="flex-1" loading={busy} disabled={!vendorName.trim() || !expectedDate}
          onClick={() => onSave({ vendorName, poNumber, unitPrice: unitPrice ? Number(unitPrice) : null, expectedDate, orderNote, qty: orderQty ? Number(orderQty) : null })}>
          Save order
        </Button>
      </div>
    </div>
  );
}

function ShipForm({ busy, unit, qty, onSave, onCancel }: { busy: boolean; unit: string; qty: number; onSave: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [shipQty, setQty] = useState(String(qty));
  const [dispatchDate, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vehicleRef, setVehicle] = useState("");
  const [photoUrl, setPhoto] = useState("");
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Input label={`Qty sent (${unit})`} value={shipQty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" required />
        <Input label="Dispatch date" type="date" value={dispatchDate} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <Input label="Vehicle / LR number" value={vehicleRef} onChange={(e) => setVehicle(e.target.value)} />
      <CameraInput label="Consignment photo (optional)" requireGeo={false} preview={photoUrl || null} onCaptured={(p) => setPhoto(p.url)} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="flex-1" loading={busy} disabled={!shipQty}
          onClick={() => onSave({ qty: Number(shipQty), dispatchDate, vehicleRef, photoUrl })}>
          Dispatch
        </Button>
      </div>
    </div>
  );
}

function CloseForm({ busy, onSave, onCancel }: { busy: boolean; onSave: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [price, setPrice] = useState("");
  const [bill, setBill] = useState("");
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
      <Input label="Price paid (₹)" hi="कीमत" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required />
      <CameraInput label="Bill photo (required)" hi="बिल फोटो" requireGeo={false} preview={bill || null} onCaptured={(p) => setBill(p.url)} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="flex-1" loading={busy} disabled={!bill || !price} onClick={() => onSave({ price: Number(price), billPhotoUrl: bill })}>
          <Bi en="Close purchase" hi="बंद करें" />
        </Button>
      </div>
    </div>
  );
}
