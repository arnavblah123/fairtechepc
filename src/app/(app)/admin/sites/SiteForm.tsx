"use client";
import { useState } from "react";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Toggle } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";

type Existing = { id: string; code: string; name: string; city: string; address: string | null; latitude: number | null; longitude: number | null; pettyCashThreshold: number; active: boolean };

export function SiteForm({ site }: { site?: Existing }) {
  const [code, setCode] = useState(site?.code ?? "");
  const [name, setName] = useState(site?.name ?? "");
  const [city, setCity] = useState(site?.city ?? "");
  const [address, setAddress] = useState(site?.address ?? "");
  const [lat, setLat] = useState(site?.latitude?.toString() ?? "");
  const [lng, setLng] = useState(site?.longitude?.toString() ?? "");
  const [threshold, setThreshold] = useState(String(site?.pettyCashThreshold ?? 5000));
  const [active, setActive] = useState(site?.active ?? true);
  const { busy, submit } = useSubmit();

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const body = { code, name, city, address, latitude: lat === "" ? null : Number(lat), longitude: lng === "" ? null : Number(lng), pettyCashThreshold: Number(threshold), active };
          if (site) submit(() => api(`/api/sites/${site.id}`, { method: "PATCH", body }), { to: "/admin/sites" });
          else submit(() => api("/api/sites", { body }), { to: "/admin/sites" });
        }}
      >
        <Input label="Site name" hi="साइट का नाम" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Site code" hi="साइट कोड" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required disabled={!!site} maxLength={8} hint="Used in job numbers, e.g. SITE → SITE-001. Cannot change later." />
        <Input label="City" hi="शहर" value={city} onChange={(e) => setCity(e.target.value)} required />
        <Input label="Address" hi="पता" value={address} onChange={(e) => setAddress(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
          <Input label="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
        </div>
        <Input label="Petty cash alert below (₹)" hi="पेटी कैश अलर्ट सीमा" value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" required />
        {site && <Toggle label="Active" hi="सक्रिय" checked={active} onChange={setActive} />}
        <Button type="submit" size="lg" full loading={busy}>
          <Bi en={site ? "Save changes" : "Create site"} hi={site ? "बदलाव सेव करें" : "साइट बनाएँ"} />
        </Button>
      </form>
    </Card>
  );
}
