"use client";
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="min-h-[40px] rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-semibold">
      🖨 Print
    </button>
  );
}
