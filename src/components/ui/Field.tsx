import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { Bi } from "./Bi";

const base =
  "w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-brand focus:outline-none disabled:bg-slate-100 min-h-[48px]";

function Wrap({ label, hi, error, hint, children, required }: { label: string; hi?: string; error?: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        <Bi en={label + (required ? " *" : "")} hi={hi} inline />
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

export function Input({ label, hi, error, hint, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hi?: string; error?: string; hint?: string }) {
  return (
    <Wrap label={label} hi={hi} error={error} hint={hint} required={rest.required}>
      <input className={`${base} ${error ? "border-red-400" : ""} ${className}`} {...rest} />
    </Wrap>
  );
}

export function Select({ label, hi, error, hint, className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hi?: string; error?: string; hint?: string }) {
  return (
    <Wrap label={label} hi={hi} error={error} hint={hint} required={rest.required}>
      <select className={`${base} ${error ? "border-red-400" : ""} ${className}`} {...rest}>
        {children}
      </select>
    </Wrap>
  );
}

export function Textarea({ label, hi, error, hint, className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hi?: string; error?: string; hint?: string }) {
  return (
    <Wrap label={label} hi={hi} error={error} hint={hint} required={rest.required}>
      <textarea className={`${base} ${error ? "border-red-400" : ""} ${className}`} rows={3} {...rest} />
    </Wrap>
  );
}

export function Toggle({ label, hi, checked, onChange, hint }: { label: string; hi?: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border-2 border-slate-300 bg-white px-3 py-2">
      <span className="text-sm font-semibold text-slate-700">
        <Bi en={label} hi={hi} inline />
        {hint && <span className="block text-xs font-normal text-slate-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-green-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${checked ? "left-7" : "left-1"}`} />
      </button>
    </label>
  );
}
