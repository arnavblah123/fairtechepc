import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, hi, back, action }: { title: string; hi?: string; back?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {back && (
        <Link href={back} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold text-slate-900">{title}</h1>
        {hi && <p className="text-sm text-slate-500">{hi}</p>}
      </div>
      {action}
    </div>
  );
}
