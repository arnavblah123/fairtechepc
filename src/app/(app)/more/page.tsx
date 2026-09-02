import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { can, ROLE_LABELS, type Capability } from "@/lib/permissions";
import { Card } from "@/components/ui/Card";
import { Bi } from "@/components/ui/Bi";
import { LogoutButton } from "./LogoutButton";

type Item = { href: string; en: string; hi: string; cap?: Capability; soon?: string };

const SECTIONS: { title: string; hi: string; items: Item[] }[] = [
  {
    title: "Site",
    hi: "साइट",
    items: [
      { href: "/jobs", en: "Jobs & stages", hi: "काम और स्टेज", cap: "job.view" },
      { href: "/workers", en: "Labour master", hi: "मज़दूर सूची", cap: "worker.view", soon: "Phase 2" },
      { href: "/plan", en: "Daily plan", hi: "दैनिक योजना", cap: "plan.submit", soon: "Phase 2" },
      { href: "/dpr", en: "Daily progress report", hi: "डीपीआर", cap: "dpr.view", soon: "Phase 3" },
      { href: "/photos", en: "Site photos", hi: "साइट फोटो", cap: "dpr.view", soon: "Phase 4" },
      { href: "/issues", en: "Issues", hi: "समस्याएँ", cap: "dpr.view", soon: "Phase 5" },
      { href: "/consumables", en: "Consumables store", hi: "कंज़्यूमेबल स्टोर", cap: "dpr.view", soon: "Phase 6" },
      { href: "/machines", en: "Machines", hi: "मशीनें", cap: "dpr.view", soon: "Phase 7" },
      { href: "/sop", en: "Daily routine (SOP)", hi: "रोज़ का काम" },
    ],
  },
  {
    title: "Money",
    hi: "पैसा",
    items: [
      { href: "/petty-cash", en: "Petty cash", hi: "पेटी कैश", cap: "money.view", soon: "Phase 8" },
      { href: "/wages", en: "Wage sheets", hi: "मज़दूरी शीट", cap: "wage.view", soon: "Phase 8" },
      { href: "/advances", en: "Advances", hi: "एडवांस", cap: "advance.approve", soon: "Phase 8" },
    ],
  },
  {
    title: "Admin",
    hi: "एडमिन",
    items: [
      { href: "/admin/users", en: "Users & passwords", hi: "यूज़र और पासवर्ड", cap: "user.manage" },
      { href: "/admin/sites", en: "Sites", hi: "साइट", cap: "site.manage" },
      { href: "/admin/audit", en: "Audit log", hi: "ऑडिट लॉग", cap: "audit.view" },
    ],
  },
];

export default async function MorePage() {
  const user = (await getSessionUser())!;
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
        const items = s.items.filter((i) => !i.cap || can(user.role, i.cap));
        if (!items.length) return null; // hidden entirely for roles without access
        return (
          <Card key={s.title} title={s.title} hi={s.hi}>
            <ul className="divide-y">
              {items.map((i) => (
                <li key={i.href}>
                  {i.soon ? (
                    <div className="flex min-h-[52px] items-center justify-between py-2 text-slate-400">
                      <Bi en={i.en} hi={i.hi} />
                      <span className="text-xs">{i.soon}</span>
                    </div>
                  ) : (
                    <Link href={i.href} className="flex min-h-[52px] items-center justify-between py-2">
                      <Bi en={i.en} hi={i.hi} className="font-semibold" />
                      <span className="text-slate-400">›</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
