import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { jobStageSummary, plannedPercentByDate } from "@/lib/jobs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card, Stat } from "@/components/ui/Card";
import { Bi } from "@/components/ui/Bi";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { formatDate, formatNum, daysBetween, istDateKey, dateToKey } from "@/lib/format";

const STATUS_TONE = { ACTIVE: "green", ON_HOLD: "amber", COMPLETED: "blue", CLOSED: "slate" } as const;

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("job.view");
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, voidedAt: null, ...(user.role === "SUPERADMIN" || user.role === "PURCHASE" ? {} : { siteId: user.siteId ?? "-" }) } });
  if (!job) notFound();
  const { stages, bottleneck, overallPercent } = await jobStageSummary(job.id);
  const materialCount = await prisma.jobMaterial.count({ where: { jobId: job.id, voidedAt: null } });
  const today = istDateKey();
  const plannedDaysTotal = daysBetween(dateToKey(job.plannedStart), dateToKey(job.plannedEnd)) + 1;
  const elapsed = Math.max(0, Math.min(plannedDaysTotal, daysBetween(dateToKey(job.plannedStart), today) + 1));
  const daysLeft = daysBetween(today, dateToKey(job.plannedEnd));
  const shouldBe = plannedPercentByDate(job.plannedStart, job.plannedEnd, today);
  const behind = overallPercent < shouldBe - 5;
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
        <Stat label="Progress" hi="प्रगति" value={`${overallPercent}%`} tone={behind ? "red" : overallPercent >= 100 ? "green" : "blue"} />
        <Stat label="Should be by today" hi="आज तक होना चाहिए" value={`${shouldBe}%`} tone={behind ? "amber" : "slate"} />
        <Stat label="Schedule" hi="समय" value={`Day ${elapsed} / ${plannedDaysTotal}`} tone={daysLeft < 0 ? "red" : "slate"} />
        <Stat label="Planned end" hi="खत्म" value={<span className="text-lg">{formatDate(job.plannedEnd)}</span>} />
      </div>

      <Card
        title="Stages"
        hi="स्टेज"
        action={isAdmin ? <Link href={`/jobs/${job.id}/stages`} className="text-sm font-semibold text-brand">Manage →</Link> : undefined}
      >
        {stages.length === 0 ? (
          <p className="text-sm text-slate-500">No stages defined yet.{isAdmin ? " Use Manage to write them all in one go." : " Ask Arnav to set them up."}</p>
        ) : (
          <ol className="space-y-3">
            {stages.map((s) => {
              const tone = s.status === "DONE" ? "bg-green-600" : s.daysOverrun > 0 ? "bg-red-500" : s.status === "IN_PROGRESS" ? "bg-brand" : "bg-slate-300";
              return (
                <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{s.sequence}. {s.name}</div>
                    <div className="text-sm font-bold">{Math.round(s.percent)}%</div>
                  </div>
                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, s.percent)}%` }} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-slate-600">
                    <div className={s.daysOverrun > 0 ? "font-semibold text-red-600" : ""}>
                      Days: <b>{s.daysUsed}</b> / {s.plannedDays}
                      {s.daysOverrun > 0 && ` (+${s.daysOverrun} over)`}
                    </div>
                    <div>{s.plannedQty > 0 ? <>Qty: <b>{formatNum(s.actualQty)}</b> / {formatNum(s.plannedQty)} {s.unit}</> : <span className="text-slate-400">tracked by time</span>}</div>
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
          <Link href={`/jobs/${job.id}/progress`} className="mt-3 flex min-h-[52px] items-center justify-center rounded-xl bg-brand font-semibold text-white">
            <Bi en="Update today's progress" hi="आज की प्रगति भरें" />
          </Link>
        )}
      </Card>

      {can(user.role, "material.plan") && (
        <Card title="Material plan" hi="सामान की योजना" action={<Link href={`/jobs/${job.id}/materials`} className="text-sm font-semibold text-brand">Manage →</Link>}>
          <p className="text-sm text-slate-600">
            {materialCount === 0
              ? "No consumables planned yet. List everything this job will need before work starts."
              : `${materialCount} consumable${materialCount === 1 ? "" : "s"} planned for this job.`}
          </p>
        </Card>
      )}

      <Card title="Details" hi="विवरण">
        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-slate-500">Client</dt>
          <dd className="col-span-2">{job.clientName}</dd>
          <dt className="text-slate-500">Drawing</dt>
          <dd className="col-span-2">{job.drawingRef ?? "—"}</dd>
          <dt className="text-slate-500">Dates</dt>
          <dd className="col-span-2">{formatDate(job.plannedStart)} → {formatDate(job.plannedEnd)}</dd>
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

      {can(user.role, "record.delete") && <DeleteButton entity="Job" id={job.id} what={`job ${job.jobNumber}`} to="/jobs" full size="md" label="Delete this job" />}
    </div>
  );
}
