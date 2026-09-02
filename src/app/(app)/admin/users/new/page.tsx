import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { UserForm } from "../UserForm";

export default async function NewUserPage() {
  await requirePage("user.manage");
  const sites = await prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div>
      <PageHeader title="Add user" hi="नया यूज़र" back="/admin/users" />
      <UserForm sites={sites} />
    </div>
  );
}
