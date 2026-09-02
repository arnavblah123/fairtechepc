import { notFound } from "next/navigation";
import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { UserForm } from "../UserForm";
import { ResetPasswordForm } from "../ResetPasswordForm";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePage("user.manage");
  const { id } = await params;
  const [u, sites] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { id: true, username: true, name: true, phone: true, role: true, siteId: true, active: true } }),
    prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!u) notFound();
  return (
    <div className="space-y-4">
      <PageHeader title={u.name} hi={`@${u.username}`} back="/admin/users" />
      <UserForm sites={sites} user={u} isSelf={u.id === me.id} />
      <ResetPasswordForm userId={u.id} />
    </div>
  );
}
