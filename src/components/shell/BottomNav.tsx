"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";

type Item = { href: string; en: string; hi: string; icon: string; roles?: Role[] };

const ITEMS: Item[] = [
  { href: "/", en: "Home", hi: "होम", icon: "⌂" },
  { href: "/jobs", en: "Jobs", hi: "काम", icon: "▦" },
  { href: "/attendance", en: "Attendance", hi: "हाज़िरी", icon: "☑", roles: ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR"] },
  { href: "/more", en: "More", hi: "और", icon: "≡" },
];

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.roles || i.roles.includes(role));
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-2xl">
        {items.map((i) => {
          const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-xs ${active ? "text-brand" : "text-slate-500"}`}
            >
              <span className="text-xl leading-none">{i.icon}</span>
              <span className="font-semibold">{i.en}</span>
              <span className="text-[10px] opacity-70">{i.hi}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
