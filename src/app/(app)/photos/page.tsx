import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/Card";
import { PhotoBoard } from "./PhotoBoard";
import { istDateKey, dateKeyToDate, dateToKey } from "@/lib/format";

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ date?: string; jobId?: string; by?: string }> }) {
  const user = await requirePage("dpr.view");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  const today = istDateKey();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const [photos, jobs, photographers] = await Promise.all([
    prisma.sitePhoto.findMany({
      where: { siteId: site.id, date: dateKeyToDate(date), voidedAt: null, ...(sp.jobId ? { jobId: sp.jobId } : {}), ...(sp.by ? { takenById: sp.by } : {}) },
      orderBy: { serverTime: "asc" },
      include: { takenBy: { select: { id: true, name: true } }, job: { select: { jobNumber: true } }, stage: { select: { name: true } } },
    }),
    prisma.job.findMany({ where: { siteId: site.id, voidedAt: null }, orderBy: { jobNumber: "asc" }, include: { stages: { where: { voidedAt: null }, orderBy: { sequence: "asc" }, select: { id: true, name: true } } } }),
    prisma.user.findMany({ where: { siteId: site.id, active: true }, select: { id: true, name: true } }),
  ]);
  return (
    <PhotoBoard
      siteId={site.id}
      date={date}
      today={today}
      canUpload={can(user.role, "photo.upload")}
      jobs={jobs.map((j) => ({ id: j.id, label: `${j.jobNumber} · ${j.name}`, stages: j.stages }))}
      photographers={photographers}
      filters={{ jobId: sp.jobId ?? "", by: sp.by ?? "" }}
      photos={photos.map((p) => ({
        id: p.id,
        url: p.url,
        slot: p.slot,
        kind: p.kind,
        caption: p.caption,
        lat: p.latitude,
        lng: p.longitude,
        time: p.serverTime.toISOString(),
        by: p.takenBy.name,
        job: p.job?.jobNumber ?? null,
        stage: p.stage?.name ?? null,
      }))}
    />
  );
}
