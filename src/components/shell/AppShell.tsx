import type { Role } from "@prisma/client";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { SiteSwitcher } from "./SiteSwitcher";
import { ROLE_LABELS } from "@/lib/permissions";

export function AppShell({
  user,
  site,
  sites,
  children,
}: {
  user: { name: string; role: Role };
  site: { id: string; name: string; code: string; city: string } | null;
  sites: { id: string; name: string; code: string }[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 bg-brand px-4 py-2 text-white shadow">
        <div className="min-w-0">
          {user.role === "SUPERADMIN" ? (
            <SiteSwitcher current={site?.id ?? null} sites={sites} />
          ) : (
            <div className="truncate font-bold">{site ? `${site.name} · ${site.city}` : "No site"}</div>
          )}
          <div className="truncate text-xs opacity-80">
            {user.name} · {ROLE_LABELS[user.role].en}
          </div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
          {user.name
            .split(/\s+/)
            .map((s) => s.replace(/[^\p{L}]/gu, "")[0] ?? "")
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
      </header>
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
      <BottomNav role={user.role} />
    </div>
  );
}
