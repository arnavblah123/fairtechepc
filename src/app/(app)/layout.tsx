import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/shell/AppShell";
import { PhotoReminder } from "@/components/shell/PhotoReminder";
import { can } from "@/lib/permissions";
import { PHOTO_SLOTS } from "@/lib/slots";
import { istDateKey, istHour, dateKeyToDate } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const site = await getCurrentSite(user);
  const sites =
    user.role === "SUPERADMIN"
      ? await prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } })
      : [];
  const reminder = site && can(user.role, "photo.upload") && user.role !== "SUPERADMIN" ? await photoReminder(site.id) : null;
  return (
    <AppShell user={{ name: user.name, role: user.role }} site={site} sites={sites}>
      {reminder && <PhotoReminder {...reminder} />}
      {children}
    </AppShell>
  );
}

/** Which of today's photo windows is open and unfilled, and which have already been missed. */
async function photoReminder(siteId: string) {
  const hour = istHour();
  const photos = await prisma.sitePhoto.findMany({
    where: { siteId, kind: "DAILY_SLOT", date: dateKeyToDate(istDateKey()), voidedAt: null },
    select: { slot: true },
  });
  const filled = new Set(photos.map((p) => p.slot));
  const open = PHOTO_SLOTS.find((s) => hour >= s.from && hour < s.to && !filled.has(s.slot));
  const missed = PHOTO_SLOTS.filter((s) => hour >= s.to && !filled.has(s.slot)).map((s) => s.label);
  const remaining = PHOTO_SLOTS.filter((s) => !filled.has(s.slot)).length;
  return { current: open ? { label: open.label, hi: open.hi } : null, missed, remaining };
}
