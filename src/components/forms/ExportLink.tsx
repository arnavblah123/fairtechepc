import { Bi } from "@/components/ui/Bi";

/** Superadmin-only CSV export button (caller must already have checked the role). */
export function ExportLink({ href }: { href: string }) {
  return (
    <a href={href} className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
      ⬇ <Bi en="CSV" inline />
    </a>
  );
}
