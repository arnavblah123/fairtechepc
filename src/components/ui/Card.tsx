import type { ReactNode } from "react";

export function Card({ children, className = "", title, hi, action }: { children: ReactNode; className?: string; title?: string; hi?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h2 className="text-base font-bold text-slate-800">
              {title}
              {hi && <span className="ml-1 text-xs font-normal text-slate-500">/ {hi}</span>}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "red" | "amber" | "blue" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ en, hi }: { en: string; hi?: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-500">
      <p>{en}</p>
      {hi && <p className="text-sm">{hi}</p>}
    </div>
  );
}

export function Stat({ label, hi, value, tone = "slate" }: { label: string; hi?: string; value: ReactNode; tone?: "slate" | "green" | "red" | "amber" | "blue" }) {
  const tones = {
    slate: "bg-white",
    green: "bg-green-50 border-green-200",
    red: "bg-red-50 border-red-200",
    amber: "bg-amber-50 border-amber-200",
    blue: "bg-blue-50 border-blue-200",
  };
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {hi && <span className="ml-1 normal-case tracking-normal">/ {hi}</span>}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
