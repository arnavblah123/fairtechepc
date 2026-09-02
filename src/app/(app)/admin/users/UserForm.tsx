"use client";
import { useState } from "react";
import type { Role } from "@prisma/client";
import { api, useSubmit } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Toggle } from "@/components/ui/Field";
import { Bi } from "@/components/ui/Bi";
import { Card } from "@/components/ui/Card";
import { ROLE_LABELS } from "@/lib/permissions";

type Existing = { id: string; username: string; name: string; phone: string | null; role: Role; siteId: string | null; active: boolean };

export function UserForm({ sites, user, isSelf }: { sites: { id: string; name: string }[]; user?: Existing; isSelf?: boolean }) {
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "SUPERVISOR");
  const [siteId, setSiteId] = useState(user?.siteId ?? sites[0]?.id ?? "");
  const [active, setActive] = useState(user?.active ?? true);
  const { busy, submit } = useSubmit();
  const needsSite = role !== "SUPERADMIN";

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const payload = { name, phone, role, siteId: needsSite ? siteId : null, active };
          if (user) {
            submit(() => api(`/api/users/${user.id}`, { method: "PATCH", body: payload }), { to: "/admin/users" });
          } else {
            submit(() => api("/api/users", { body: { ...payload, username, password } }), { to: "/admin/users" });
          }
        }}
      >
        <Input label="Full name" hi="पूरा नाम" value={name} onChange={(e) => setName(e.target.value)} required />
        {user ? (
          <Input label="Username" hi="यूज़रनेम" value={username} disabled />
        ) : (
          <Input label="Username" hi="यूज़रनेम" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" required hint="Lowercase letters, numbers, dot, dash" />
        )}
        {!user && <Input label="Password" hi="पासवर्ड" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} hint="At least 6 characters. Share it with the user in person." />}
        <Input label="Phone" hi="फ़ोन" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        <Select label="Role" hi="भूमिका" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r].en} / {ROLE_LABELS[r].hi}
            </option>
          ))}
        </Select>
        {needsSite && (
          <Select label="Site" hi="साइट" value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.length === 0 && <option value="">Create a site first</option>}
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        {user && !isSelf && <Toggle label="Active" hi="सक्रिय" checked={active} onChange={setActive} hint="Inactive users cannot log in. Nothing is deleted." />}
        <Button type="submit" size="lg" full loading={busy}>
          <Bi en={user ? "Save changes" : "Create user"} hi={user ? "बदलाव सेव करें" : "यूज़र बनाएँ"} />
        </Button>
      </form>
    </Card>
  );
}
