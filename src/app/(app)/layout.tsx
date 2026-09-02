import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getCurrentSite } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const site = await getCurrentSite(user);
  const sites =
    user.role === "SUPERADMIN"
      ? await prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } })
      : [];
  return (
    <AppShell user={{ name: user.name, role: user.role }} site={site} sites={sites}>
      {children}
    </AppShell>
  );
}
