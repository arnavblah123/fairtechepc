/** Planned vs actual cumulative MT — simple server-rendered SVG line chart. */
export function ProgressChart({ totalPlannedMT, planStart, planEnd, actualCum, today }: {
  totalPlannedMT: number; planStart: string; planEnd: string;
  actualCum: { date: string; mt: number }[]; today: string;
}) {
  const W = 320, H = 140, PL = 34, PB = 18, PT = 8, PR = 8;
  const t0 = Date.parse(planStart), t1 = Math.max(Date.parse(planEnd), Date.parse(today));
  const span = Math.max(1, t1 - t0);
  const maxY = Math.max(totalPlannedMT, actualCum.at(-1)?.mt ?? 0, 1);
  const x = (d: string) => PL + ((Date.parse(d) - t0) / span) * (W - PL - PR);
  const y = (v: number) => H - PB - (v / maxY) * (H - PB - PT);
  const actualPts = [{ date: planStart, mt: 0 }, ...actualCum].map((p) => `${x(p.date).toFixed(1)},${y(p.mt).toFixed(1)}`).join(" ");
  const lastActual = actualCum.at(-1);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Planned vs actual MT">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PL} x2={W - PR} y1={y(maxY * f)} y2={y(maxY * f)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PL - 4} y={y(maxY * f) + 3} textAnchor="end" fontSize="9" fill="#64748b">{Math.round(maxY * f)}</text>
          </g>
        ))}
        <line x1={x(planStart)} y1={y(0)} x2={x(planEnd)} y2={y(totalPlannedMT)} stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 4" />
        <polyline points={actualPts} fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinejoin="round" />
        {lastActual && <circle cx={x(lastActual.date)} cy={y(lastActual.mt)} r="3.5" fill="#1d4ed8" />}
        <text x={PL} y={H - 4} fontSize="9" fill="#64748b">{planStart.slice(8)}-{planStart.slice(5, 7)}</text>
        <text x={W - PR} y={H - 4} fontSize="9" fill="#64748b" textAnchor="end">{planEnd.slice(8)}-{planEnd.slice(5, 7)}</text>
      </svg>
      <div className="mt-1 flex justify-center gap-4 text-xs text-slate-600">
        <span><span className="mr-1 inline-block h-0.5 w-4 bg-slate-400 align-middle" style={{ borderTop: "2px dashed #94a3b8", background: "none" }} />Planned {Math.round(totalPlannedMT)} MT</span>
        <span><span className="mr-1 inline-block h-1 w-4 rounded bg-brand align-middle" />Actual {lastActual ? lastActual.mt : 0} MT</span>
      </div>
    </div>
  );
}
