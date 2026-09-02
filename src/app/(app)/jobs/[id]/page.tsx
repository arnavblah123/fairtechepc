import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { jobStageSummary } from "@/lib/jobs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card, Stat } from "@/components/ui/Card";
import { Bi } from "@/components/ui/Bi";
import { formatDate, formatNum, daysBetween, istDateKey, dateToKey } from "@/lib/format";
import { VoidJobButton } from "./VoidJobButton";

const STATUS_TONE = { ACTIVE: "green", ON_HOLD: "amber", COMPLETED: "blue", CLOSED: "slate" } as const;

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("job.view");
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, voidedAt: null, ...(user.role === "SUPERADMIN" ? {} : { siteId: user.siteId ?? "-" }) } });
  if (!job) notFound();
  const { stages, bottleneck, overallPercent } = await jobStageSummary(job.id);
  const today = istDateKey();
  const plannedDaysTotal = daysBetween(dateToKey(job.plannedStart), dateToKey(job.plannedEnd)) + 1;
  const elapsed = Math.max(0, Math.min(plannedDaysTotal, daysBetween(dateToKey(job.plannedStart), today) + 1));
  const daysLeft = daysBetween(today, dateToKey(job.plannedEnd));
  const isAdmin = can(user.role, "job.manage");

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${job.jobNumber} · ${job.name}`}
        hi={job.clientName}
        back="/jobs"
        action={isAdmin ? <Link href={`/jobs/${job.id}/edit`} className="rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold">Edit</Link> : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[job.status]}>{job.status.replace("_", " ")}</Badge>
        {bottleneck && <Badge tone="red">Bottleneck: {bottleneck.name} (+{bottleneck.daysOverrun} d)</Badge>}
        {daysLeft < 0 && job.status === "ACTIVE" && <Badge tone="red">{-daysLeft} days past planned end</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Overall progress" hi="कुल प्रगति" value={`${overallPercent}%`} tone={overallPercent >= 100 ? "green" : "blue"} />
        <Stat label="Planned MT" hi="योजना टन" value={formatNum(job.plannedTonnage)} />
        <Stat label="Schedule" hi="समय" value={`Day ${elapsed} / ${plannedDaysTotal}`} tone={daysLeft < 0 ? "red" : "slate"} />
        <Stat label="Planned end" hi="खत्म" value={<span className="text-lg">{formatDate(job.plannedEnd)}</span>} />
      </div>

      <Card
        title="Stages"
        hi="स्टेज"
        action={
          isAdmin ? (
            <Link href={`/jobs/${job.id}/stages`} className="text-sm font-semibold text-brand">
              Manage →
            </Link>
          ) : undefined
        }
      >
        {stages.length === 0 ? (
          <p className="text-sm text-slate-500">No stages defined yet.{isAdmin ? " Use Manage to add them." : " Ask Arnav to set them up."}</p>
        ) : (
          <ol className="space-y-3">
            {stages.map((s) => {
              const tone = s.status === "DONE" ? "bg-green-600" : s.daysOverrun > 0 ? "bg-red-500" : s.status === "IN_PROGRESS" ? "bg-brand" : "bg-slate-300";
              return (
                <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {s.sequence}. {s.name}
                    </div>
                    <div className="text-sm font-bold">{Math.round(s.percent)}%</div>
                  </div>
                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, s.percent)}%` }} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-slate-600">
                    <div>
                      Qty: <b>{formatNum(s.actualQty)}</b> / {formatNum(s.plannedQty)} {s.unit}
                    </div>
                    <div className={s.daysOverrun > 0 ? "font-semibold text-red-600" : ""}>
                      Days: <b>{s.daysUsed}</b> / {s.plannedDays}
                      {s.daysOverrun > 0 && ` (+${s.daysOverrun})`}
                    </div>
                    <div className="col-span-2 text-slate-400">
                      {s.status === "NOT_STARTED" ? "Not started" : `${formatDate(s.actualStart)} → ${s.actualEnd ? formatDate(s.actualEnd) : "ongoing"}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {can(user.role, "stage.progress") && stages.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            <Bi en="Daily stage progress entry arrives in Phase 3." hi="दैनिक स्टेज प्रगति फेज़ 3 में आएगी।" />
          </p>
        )}
      </Card>

      <Card title="Details" hi="विवरण">
        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-slate-500">Client</dt>
          <dd className="col-span-2">{job.clientName}</dd>
          <dt className="text-slate-500">Drawing</dt>
          <dd className="col-span-2">{job.drawingRef ?? "—"}</dd>
          <dt className="text-slate-500">Dates</dt>
          <dd className="col-span-2">
            {formatDate(job.plannedStart)} → {formatDate(job.plannedEnd)}
          </dd>
          {isAdmin && (
            <>
              <dt className="text-slate-500">Welding norm</dt>
              <dd className="col-span-2">{job.weldingNormKgPerMT ? `${formatNum(job.weldingNormKgPerMT)} kg / MT` : "not set"}</dd>
            </>
          )}
          <dt className="text-slate-500">Description</dt>
          <dd className="col-span-2 whitespace-pre-wrap">{job.description ?? "—"}</dd>
        </dl>
      </Card>

      {isAdmin && <VoidJobButton jobId={job.id} />}
    </div>
  );
}
