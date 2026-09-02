"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; kind: "success" | "error" | "info"; en: string; hi?: string };
type Ctx = { push: (t: Omit<Toast, "id">) => void; saved: () => void; error: (msg: string) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.kind === "error" ? 5000 : 2500);
  }, []);

  const saved = useCallback(() => push({ kind: "success", en: "Saved ✓", hi: "सेव हो गया" }), [push]);
  const error = useCallback((msg: string) => push({ kind: "error", en: msg }), [push]);

  return (
    <ToastCtx.Provider value={{ push, saved, error }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-center text-white shadow-lg ${
              t.kind === "success" ? "bg-green-600" : t.kind === "error" ? "bg-red-600" : "bg-slate-800"
            }`}
          >
            <div className="font-semibold">{t.en}</div>
            {t.hi && <div className="text-sm opacity-90">{t.hi}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}
