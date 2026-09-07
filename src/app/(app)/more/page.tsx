import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { can, ROLE_LABELS, type Capability } from "@/lib/permissions";
import { Card } from "@/components/ui/Card";
import { Bi } from "@/components/ui/Bi";
import { LogoutButton } from "./LogoutButton";

type Item = { href: string; en: string; hi: string; cap?: Capability; caps?: Capability[] };

const SECTIONS: { title: string; hi: string; items: Item[] }[] = [
  {
    title: "Site",
    hi: "साइट",
    items: [
      { href: "/jobs", en: "Jobs & stages", hi: "काम और स्टेज", cap: "job.view" },
      { href: "/workers", en: "Labour master", hi: "मज़दूर सूची", cap: "worker.view" },
      { href: "/attendance", en: "Attendance", hi: "हाज़िरी", cap: "attendance.mark" },
      { href: "/plan", en: "Daily plan", hi: "दैनिक योजना", cap: "plan.submit" },
      { href: "/dpr", en: "Daily progress report", hi: "डीपीआर", cap: "dpr.view" },
      { href: "/photos", en: "Site photos", hi: "साइट फोटो", cap: "dpr.view" },
      { href: "/issues", en: "Issues", hi: "समस्याएँ", cap: "dpr.view" },
      { href: "/consumables", en: "Consumables store", hi: "कंज़्यूमेबल स्टोर", cap: "dpr.view" },
      { href: "/machines", en: "Machines", hi: "मशीनें", cap: "dpr.view" },
      { href: "/sop", en: "Daily routine (SOP)", hi: "रोज़ का काम" },
    ],
  },
  {
    title: "Money",
    hi: "पैसा",
    items: [
      { href: "/petty-cash", en: "Petty cash", hi: "पेटी कैश", caps: ["money.view", "petty.expense", "petty.request"] },
      { href: "/advances", en: "Worker advances", hi: "एडवांस", caps: ["advance.approve", "advance.request"] },
      { href: "/wages", en: "Wage sheets", hi: "मज़दूरी शीट", cap: "wage.view" },
    ],
  },
  {
    title: "Admin",
    hi: "एडमिन",
    items: [
      { href: "/admin/users", en: "Users & passwords", hi: "यूज़र और पासवर्ड", cap: "user.manage" },
      { href: "/admin/sites", en: "Sites", hi: "साइट", cap: "site.manage" },
      { href: "/admin/holidays", en: "Site holidays", hi: "छुट्टियाँ", cap: "holiday.manage" },
      { href: "/admin/items", en: "Consumable item master", hi: "आइटम सूची", cap: "consumable.approve" },
      { href: "/admin/unlocks", en: "Unlock past date", hi: "पुरानी तारीख़ खोलें", cap: "backdate.unlock" },
      { href: "/admin/audit", en: "Audit log", hi: "ऑडिट लॉग", cap: "audit.view" },
    ],
  },
];

export default async function MorePage() {
  const user = (await getSessionUser())!;
  const allowed = (i: Item) => {
    if (i.caps) return i.caps.some((c) => can(user.role, c));
    return !i.cap || can(user.role, i.cap);
  };
  return (
    <div className="space-y-4">
      <Card>
        <div className="font-bold">{user.name}</div>
        <div className="text-sm text-slate-500">
          @{user.username} · {ROLE_LABELS[user.role].en} / {ROLE_LABELS[user.role].hi}
        </div>
        <div className="mt-3 flex gap-2">
          <Link href="/account" className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-3 text-center text-sm font-semibold">
            <Bi en="Change password" hi="पासवर्ड बदलें" />
          </Link>
          <LogoutButton />
        </div>
      </Card>
      {SECTIONS.map((s) => {
        const items = s.items.filter(allowed);
        if (!items.length) return null; // sections a role cannot use are not rendered at all
        return (
          <Card key={s.title} title={s.title} hi={s.hi}>
            <ul className="divide-y">
              {items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="flex min-h-[52px] items-center justify-between py-2">
                    <Bi en={i.en} hi={i.hi} className="font-semibold" />
                    <span className="text-slate-400">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
