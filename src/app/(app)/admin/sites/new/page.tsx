import { requirePage } from "@/lib/page";
import { PageHeader } from "@/components/ui/PageHeader";
import { SiteForm } from "../SiteForm";

export default async function NewSitePage() {
  await requirePage("site.manage");
  return (
    <div>
      <PageHeader title="Add site" hi="नई साइट" back="/admin/sites" />
      <SiteForm />
    </div>
  );
}
