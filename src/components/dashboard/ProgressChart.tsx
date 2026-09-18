/**
 * Where each job actually is against where the plan says it should be today.
 * Progress comes from stage quantities, not tonnage.
 */
export function ProgressChart({ jobs }: { jobs: { id: string; jobNumber: string; name: string; percent: number; shouldBe: number }[] }) {
  if (jobs.length === 0) return <p className="text-sm text-slate-500">No active jobs.</p>;
  return (
    <div className="space-y-3">
      {jobs.map((j) => {
        const behind = j.percent < j.shouldBe - 5;
        return (
          <div key={j.id}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="min-w-0 truncate font-semibold">{j.jobNumber} · {j.name}</span>
              <span className={`shrink-0 font-bold ${behind ? "text-red-600" : "text-green-700"}`}>
                {j.percent}% <span className="font-normal text-slate-400">/ {j.shouldBe}%</span>
              </span>
            </div>
            <div className="relative mt-1 h-4 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full ${behind ? "bg-red-500" : "bg-brand"}`} style={{ width: `${Math.min(100, j.percent)}%` }} />
              {/* marker for where the plan says it should be today */}
              <div className="absolute inset-y-0 w-0.5 bg-slate-700" style={{ left: `${Math.min(100, j.shouldBe)}%` }} title="Planned by today" />
            </div>
          </div>
        );
      })}
      <div className="flex justify-center gap-4 pt-1 text-xs text-slate-600">
        <span><span className="mr-1 inline-block h-2 w-4 rounded bg-brand align-middle" />Actual progress</span>
        <span><span className="mr-1 inline-block h-3 w-0.5 bg-slate-700 align-middle" />Planned by today</span>
      </div>
    </div>
  );
}
