import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { JobForm } from "../JobForm";

export default async function NewJobPage() {
  const user = await requirePage("job.manage");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="Create a site first." />;
  return (
    <div>
      <PageHeader title="New job" hi="नया काम" back="/jobs" />
      <p className="mb-3 text-sm text-slate-500">
        Site: <b>{site.name}</b>. Job number will be {site.code}-XXX automatically.
      </p>
      <JobForm siteId={site.id} withPreset />
    </div>
  );
}
