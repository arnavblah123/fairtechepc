"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The nudge that greets site staff on every screen until today's photo for the
 * current window is in. Hidden on the photos screen itself.
 */
export function PhotoReminder({ current, missed, remaining }: { current: { label: string; hi: string } | null; missed: string[]; remaining: number }) {
  const path = usePathname();
  if (path.startsWith("/photos")) return null;
  if (!current && missed.length === 0) return null;
  const urgent = !!current;
  return (
    <Link
      href="/photos"
      className={`no-print mb-4 flex items-center gap-3 rounded-2xl border-2 px-4 py-3 shadow-sm ${urgent ? "border-red-400 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}
    >
      <span className="text-3xl">📷</span>
      <span className="min-w-0 flex-1">
        {current ? (
          <>
            <span className="block font-bold">Take the {current.label} site photo now</span>
            <span className="block text-sm">{current.hi} की साइट फोटो अभी लें · {remaining} of 3 still to do today</span>
          </>
        ) : (
          <>
            <span className="block font-bold">Missed today: {missed.join(", ")}</span>
            <span className="block text-sm">छूट गई फोटो — अगली खिड़की में ज़रूर लें</span>
          </>
        )}
      </span>
      <span className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold shadow">Open →</span>
    </Link>
  );
}
