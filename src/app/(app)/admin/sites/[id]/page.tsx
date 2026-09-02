import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { SiteForm } from "../SiteForm";

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("site.manage");
  const { id } = await params;
  const s = await prisma.site.findUnique({ where: { id } });
  if (!s) notFound();
  return (
    <div>
      <PageHeader title={s.name} hi={s.code} back="/admin/sites" />
      <SiteForm site={{ ...s, pettyCashThreshold: Number(s.pettyCashThreshold) }} />
    </div>
  );
}
