"use client";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost" | "outline";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white active:bg-brand-dark shadow-sm",
  secondary: "bg-slate-800 text-white active:bg-slate-900",
  danger: "bg-red-600 text-white active:bg-red-700",
  success: "bg-green-600 text-white active:bg-green-700",
  ghost: "bg-transparent text-brand active:bg-brand-light",
  outline: "bg-white border-2 border-slate-300 text-slate-800 active:bg-slate-100",
};
const sizes: Record<Size, string> = {
  sm: "min-h-[40px] px-3 text-sm",
  md: "min-h-[48px] px-4 text-base",
  lg: "min-h-[56px] px-5 text-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", full = false) {
  return `inline-flex items-center justify-center gap-2 rounded-xl font-semibold select-none transition disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""}`;
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  loading,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; full?: boolean; loading?: boolean; children: ReactNode }) {
  return (
    <button className={`${buttonClass(variant, size, full)} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  full,
  children,
  className = "",
}: { href: string; variant?: Variant; size?: Size; full?: boolean; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`${buttonClass(variant, size, full)} ${className}`}>
      {children}
    </Link>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
