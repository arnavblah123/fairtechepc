"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Badge, Card } from "@/components/ui/Card";
import { CameraInput } from "@/components/forms/CameraInput";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { formatDate, formatINR } from "@/lib/format";

type Req = {
  id: string; indentId: string | null; indentNo: string | null; item: string; unit: string; qty: number; reason: string; neededBy: string;
  status: string; fulfilment: string | null; by: string; decidedBy: string | null; note: string | null;
  price: number | null; vendor: string | null; poNumber: string | null; unitPrice: number | null;
  expectedDate: string | null; orderedBy: string | null; shipped: boolean; awaitingInward: boolean;
};
type Item = { id: string; name: string; unit: string };
type Line = { itemId: string; qty: string };
const TONE = { PENDING: "amber", APPROVED: "blue", ORDERED: "blue", REJECTED: "red", FULFILLED: "green" } as const;
const FULFILMENT_LABEL: Record<string, string> = { FROM_FACTORY: "from factory", PURCHASE_ORDER: "purchase order", LOCAL_PURCHASE: "local buy" };

/**
 * The purchase pipeline. The site asks for everything it needs in one indent;
 * each item stays its own line so approval, ordering and inward work per item,
 * and the whole indent can be approved in one tap.
 */
export function RequestsBoard({
  siteId, canRequest, canApprove, canOrder, canShip, canClose, canDelete, canPropose, showPrices, items: initialItems, requests, openNew = false,
}: {
  siteId: string; canRequest: boolean; canApprove: boolean; canOrder: boolean; canShip: boolean; canClose: boolean; canDelete: boolean; canPropose: boolean; showPrices: boolean; openNew?: boolean;
  items: Item[]; requests: Req[];
}) {
  const [items, setItems] = useState(initialItems);
  const [showNew, setShowNew] = useState(openNew && canRequest);
  const [lines, setLines] = useState<Line[]>([{ itemId: "", qty: "" }]);
  const [reason, setReason] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [proposing, setProposing] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("nos");
  const [panel, setPanel] = useState<{ id: string; kind: "order" | "ship" | "close" } | null>(null);
  const { busy, submit } = useSubmit();

  const itemOf = (id: string) => items.find((i) => i.id === id);
  const usable = lines.filter((l) => l.itemId && Number(l.qty) > 0);
  const chosen = new Set(lines.map((l) => l.itemId));
  const picks = items.filter((i) => !chosen.has(i.id) && i.name.toLowerCase().includes(search.toLowerCase()));

  const addItem = (id: string) => {
    const blank = lines.findIndex((l) => !l.itemId);
    const next = [...lines];
    if (blank >= 0) next[blank] = { itemId: id, qty: "" };
    else next.push({ itemId: id, qty: "" });
    setLines(next);
    setSearch("");
  };

  const step = (r: Req) => {
    if (r.status === "PENDING") return "Waiting for Arnav's approval";
    if (r.status === "APPROVED" && r.fulfilment === "LOCAL_PURCHASE") return "Site to buy locally and upload the bill";
    if (r.status === "APPROVED") return "Waiting for purchase (Pune) to place the order";
    if (r.status === "ORDERED" && !r.shipped) return "Ordered — waiting for dispatch";
    if (r.status === "ORDERED" && r.awaitingInward) return "In transit — site to inward and accept";
    if (r.status === "FULFILLED") return "Inwarded and accepted at site";
    return "";
  };

  // Group by indent, newest first; lines raised singly (older data) stand alone.
  const groups: { key: string; indentNo: string | null; reason: string; neededBy: string; by: string; lines: Req[] }[] = [];
  for (const r of requests) {
    const key = r.indentId ?? r.id;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, indentNo: r.indentNo, reason: r.reason, neededBy: r.neededBy, by: r.by, lines: [] };
      groups.push(g);
    }
    g.lines.push(r);
  }

  return (
    <div className="space-y-4">
      {canRequest && (showNew ? (
        <Card title="Ask for material" hi="सामान माँगें">
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            const r = await submit(() => api(`/api/consumables/indents?siteId=${siteId}`, { body: { reason, neededBy, note, items: usable.map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })) } }));
            if (r) { setShowNew(false); setLines([{ itemId: "", qty: "" }]); setReason(""); setNeededBy(""); setNote(""); }
          }}>
            <p className="text-sm text-slate-600"><Bi en="Add every item you need, then send once." hi="जो भी चाहिए सब जोड़ें, फिर एक बार भेजें।" /></p>

            {lines.filter((l) => l.itemId).map((l) => {
              const it = itemOf(l.itemId)!;
              const idx = lines.indexOf(l);
              return (
                <div key={l.itemId} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{it.name}</span>
                  <input className="w-24 rounded-lg border-2 border-slate-300 p-2 text-base" inputMode="decimal" placeholder="qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === idx ? { ...x, qty: e.target.value } : x)))} aria-label={`Quantity of ${it.name}`} autoFocus={!l.qty} />
                  <span className="w-10 text-xs text-slate-500">{it.unit}</span>
                  <button type="button" className="px-1 font-bold text-red-600" onClick={() => setLines(lines.filter((_, j) => j !== idx))}>✕</button>
                </div>
              );
            })}

            <div>
              <input className="w-full rounded-xl border-2 border-slate-300 p-3 text-base" placeholder={usable.length ? "Add another item…" : "Search item…"} value={search} onChange={(e) => setSearch(e.target.value)} />
              {(search || !usable.length) && (
                <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border bg-white">
                  {picks.slice(0, 40).map((i) => (
                    <button key={i.id} type="button" onClick={() => addItem(i.id)} className="flex w-full items-center justify-between border-b px-3 py-2.5 text-left text-sm last:border-0">
                      <span className="min-w-0 truncate">{i.name}</span><span className="shrink-0 text-xs text-slate-400">{i.unit}</span>
                    </button>
                  ))}
                  {picks.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">No match.</p>}
                </div>
              )}
            </div>

            {canPropose && (proposing ? (
              <div className="space-y-2 rounded-xl bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900"><Bi en="Add the missing item. Arnav will be asked to confirm it, but your request goes ahead now." hi="नया आइटम जोड़ें। अरनव बाद में पक्का करेंगे, पर रिक्वेस्ट अभी जाएगी।" /></p>
                <Input label="Item name" hi="आइटम का नाम" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
                <Input label="Unit" hi="इकाई" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} required placeholder="kg / nos / litre" />
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setProposing(false)}>Cancel</Button>
                  <Button type="button" size="sm" className="flex-1" loading={busy} disabled={newName.trim().length < 2} onClick={async () => {
                    const r = await submit(() => api<{ id: string; name: string; unit: string }>(`/api/items/propose?siteId=${siteId}`, { body: { name: newName, unit: newUnit } }), { refresh: false });
                    if (r) {
                      if (!items.some((i) => i.id === r.id)) setItems([...items, { id: r.id, name: r.name, unit: r.unit }].sort((a, b) => a.name.localeCompare(b.name)));
                      addItem(r.id); setProposing(false); setNewName("");
                    }
                  }}>Add &amp; select</Button>
                </div>
              </div>
            ) : (
              <button type="button" className="text-sm font-semibold text-brand" onClick={() => setProposing(true)}>+ <Bi en="Item not in the list? Add it" hi="आइटम सूची में नहीं? जोड़ें" inline /></button>
            ))}

            <Input label="What is it for?" hi="किस लिए" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
            <Input label="Needed by" hi="कब तक चाहिए" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} required />
            <Textarea label="Note (optional)" hi="टिप्पणी" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" full size="lg" loading={busy} disabled={usable.length === 0}>
              <Bi en={`Send request for ${usable.length} item${usable.length === 1 ? "" : "s"}`} hi="रिक्वेस्ट भेजें" />
            </Button>
          </form>
        </Card>
      ) : (
        <Button full size="lg" onClick={() => setShowNew(true)}>+ <Bi en="Request material" hi="सामान माँगें" /></Button>
      ))}

      {groups.map((g) => {
        const pending = g.lines.filter((l) => l.status === "PENDING");
        return (
          <Card key={g.key} className="!p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold">{g.indentNo ?? "Request"} <span className="font-normal text-slate-500">· {g.lines.length} item{g.lines.length === 1 ? "" : "s"}</span></div>
                <div className="text-xs text-slate-500">{g.reason} · needed by {formatDate(g.neededBy)} · {g.by}</div>
              </div>
              {pending.length > 0 && <Badge tone="amber">{pending.length} pending</Badge>}
            </div>
            {canApprove && g.indentNo && pending.length > 1 && (
              <div className="mb-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2">
                <span className="col-span-2 text-xs font-semibold text-slate-600">All {pending.length} pending lines:</span>
                <Button size="sm" variant="success" loading={busy} onClick={() => submit(() => api(`/api/consumables/indents/${g.key}/decide`, { body: { decision: "APPROVED", fulfilment: "PURCHASE_ORDER" } }))}>✓ Purchase buys</Button>
                <Button size="sm" variant="success" loading={busy} onClick={() => submit(() => api(`/api/consumables/indents/${g.key}/decide`, { body: { decision: "APPROVED", fulfilment: "FROM_FACTORY" } }))}>✓ From factory</Button>
                <Button size="sm" variant="secondary" loading={busy} onClick={() => submit(() => api(`/api/consumables/indents/${g.key}/decide`, { body: { decision: "APPROVED", fulfilment: "LOCAL_PURCHASE" } }))}>✓ Site buys local</Button>
                <Button size="sm" variant="danger" loading={busy} onClick={() => { const n = window.prompt("Reason for rejecting all?") ?? ""; if (n.trim()) submit(() => api(`/api/consumables/indents/${g.key}/decide`, { body: { decision: "REJECTED", note: n } })); }}>✕ Reject all</Button>
              </div>
            )}
            <ul className="divide-y">
              {g.lines.map((r) => (
                <li key={r.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 font-semibold">{r.item} · {r.qty} {r.unit}</span>
                    <Badge tone={TONE[r.status as keyof typeof TONE]}>{r.status}{r.fulfilment ? ` · ${FULFILMENT_LABEL[r.fulfilment]}` : ""}</Badge>
                  </div>
                  {r.decidedBy && <div className="text-xs text-slate-500">decided by {r.decidedBy}{r.note ? ` · ${r.note}` : ""}</div>}
                  {r.vendor && (
                    <div className="text-xs text-slate-600">
                      🧾 {r.vendor}{r.poNumber ? ` · PO ${r.poNumber}` : ""}{showPrices && r.unitPrice !== null ? ` · ${formatINR(r.unitPrice)}/${r.unit}` : ""}
                      {r.expectedDate ? ` · due ${formatDate(r.expectedDate)}` : ""}{r.orderedBy ? ` · ${r.orderedBy}` : ""}
                    </div>
                  )}
                  {showPrices && r.price !== null && <div className="text-xs text-slate-600">Bought for {formatINR(r.price)}</div>}
                  <div className="mt-1 text-xs font-semibold text-brand">{step(r)}</div>

                  {canApprove && r.status === "PENDING" && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button size="sm" variant="success" loading={busy} onClick={() => submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "APPROVED", fulfilment: "PURCHASE_ORDER" } }))}>✓ Purchase buys</Button>
                      <Button size="sm" variant="success" loading={busy} onClick={() => submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "APPROVED", fulfilment: "FROM_FACTORY" } }))}>✓ From factory</Button>
                      <Button size="sm" variant="secondary" loading={busy} onClick={() => submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "APPROVED", fulfilment: "LOCAL_PURCHASE" } }))}>✓ Site buys local</Button>
                      <Button size="sm" variant="danger" loading={busy} onClick={() => { const n = window.prompt("Reason for rejection?") ?? ""; if (n.trim()) submit(() => api(`/api/consumables/requests/${r.id}/decide`, { body: { decision: "REJECTED", note: n } })); }}>✕ Reject</Button>
                    </div>
                  )}
                  {canOrder && r.status === "APPROVED" && r.fulfilment !== "LOCAL_PURCHASE" && (
                    panel?.id === r.id && panel.kind === "order" ? (
                      <OrderForm busy={busy} unit={r.unit} qty={r.qty} onCancel={() => setPanel(null)} onSave={async (body) => { const ok = await submit(() => api(`/api/consumables/requests/${r.id}/order`, { body })); if (ok) setPanel(null); }} />
                    ) : (
                      <Button size="sm" variant="primary" className="mt-2" onClick={() => setPanel({ id: r.id, kind: "order" })}><Bi en="Place order with vendor" hi="ऑर्डर करें" /></Button>
                    )
                  )}
                  {canShip && (r.status === "ORDERED" || (r.status === "APPROVED" && r.fulfilment === "FROM_FACTORY")) && !r.awaitingInward && (
                    panel?.id === r.id && panel.kind === "ship" ? (
                      <ShipForm busy={busy} unit={r.unit} qty={r.qty} onCancel={() => setPanel(null)} onSave={async (body) => { const ok = await submit(() => api(`/api/consumables/requests/${r.id}/ship`, { body })); if (ok) setPanel(null); }} />
                    ) : (
                      <Button size="sm" variant="secondary" className="mt-2" onClick={() => setPanel({ id: r.id, kind: "ship" })}><Bi en="Dispatch to site" hi="साइट भेजें" /></Button>
                    )
                  )}
                  {r.awaitingInward && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">Material dispatched — the site inwards it on the Dispatches screen.</p>}
                  {canClose && r.status === "APPROVED" && r.fulfilment === "LOCAL_PURCHASE" && (
                    panel?.id === r.id && panel.kind === "close" ? (
                      <CloseForm busy={busy} onCancel={() => setPanel(null)} onSave={async (body) => { const ok = await submit(() => api(`/api/consumables/requests/${r.id}/close`, { body })); if (ok) setPanel(null); }} />
                    ) : (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => setPanel({ id: r.id, kind: "close" })}><Bi en="Bought it — enter bill" hi="खरीद लिया — बिल भरें" /></Button>
                    )
                  )}
                  {canDelete && <div className="mt-2"><DeleteButton entity="ConsumableRequest" id={r.id} what={`request for ${r.item}`} icon /></div>}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      {groups.length === 0 && <Card><p className="py-3 text-sm text-slate-500">No requests yet.</p></Card>}
    </div>
  );
}

function OrderForm({ busy, unit, qty, onSave, onCancel }: { busy: boolean; unit: string; qty: number; onSave: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [vendorName, setVendor] = useState(""); const [poNumber, setPo] = useState(""); const [unitPrice, setPrice] = useState("");
  const [expectedDate, setDate] = useState(""); const [orderQty, setQty] = useState(String(qty)); const [orderNote, setNote] = useState("");
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
      <Input label="Vendor" hi="विक्रेता" value={vendorName} onChange={(e) => setVendor(e.target.value)} required list="vendor-names" />
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
        <Button size="sm" className="flex-1" loading={busy} disabled={!vendorName.trim() || !expectedDate} onClick={() => onSave({ vendorName, poNumber, unitPrice: unitPrice ? Number(unitPrice) : null, expectedDate, orderNote, qty: orderQty ? Number(orderQty) : null })}>Save order</Button>
      </div>
    </div>
  );
}

function ShipForm({ busy, unit, qty, onSave, onCancel }: { busy: boolean; unit: string; qty: number; onSave: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [shipQty, setQty] = useState(String(qty)); const [dispatchDate, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vehicleRef, setVehicle] = useState(""); const [photoUrl, setPhoto] = useState("");
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
        <Button size="sm" className="flex-1" loading={busy} disabled={!shipQty} onClick={() => onSave({ qty: Number(shipQty), dispatchDate, vehicleRef, photoUrl })}>Dispatch</Button>
      </div>
    </div>
  );
}

function CloseForm({ busy, onSave, onCancel }: { busy: boolean; onSave: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [price, setPrice] = useState(""); const [vendorName, setVendor] = useState(""); const [bill, setBill] = useState("");
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
      <Input label="Shop / vendor" hi="दुकान" value={vendorName} onChange={(e) => setVendor(e.target.value)} required list="vendor-names" />
      <Input label="Price paid (₹)" hi="कीमत" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required />
      <CameraInput label="Bill photo (required)" hi="बिल फोटो" requireGeo={false} preview={bill || null} onCaptured={(p) => setBill(p.url)} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="flex-1" loading={busy} disabled={!bill || !price || vendorName.trim().length < 2} onClick={() => onSave({ price: Number(price), billPhotoUrl: bill, vendorName })}><Bi en="Close purchase" hi="बंद करें" /></Button>
      </div>
    </div>
  );
}
