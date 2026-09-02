"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function SiteSwitcher({ current, sites }: { current: string | null; sites: { id: string; name: string; code: string }[] }) {
  const router = useRouter();
  if (sites.length === 0) return <div className="font-bold">No site yet</div>;
  return (
    <select
      aria-label="Site"
      className="max-w-[60vw] rounded-lg bg-white/15 px-2 py-1 font-bold text-white focus:outline-none"
      value={current ?? ""}
      onChange={async (e) => {
        await api("/api/sites/select", { body: { siteId: e.target.value } });
        router.refresh();
      }}
    >
      {sites.map((s) => (
        <option key={s.id} value={s.id} className="text-slate-900">
          {s.name}
        </option>
      ))}
    </select>
  );
}
