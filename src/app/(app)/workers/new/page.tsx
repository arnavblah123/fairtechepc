import { requirePage } from "@/lib/page";
import { getCurrentSite } from "@/lib/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";
import { WorkerForm } from "../WorkerForm";

export default async function NewWorkerPage() {
  const user = await requirePage("worker.manage");
  const site = await getCurrentSite(user);
  if (!site) return <EmptyState en="No site selected." />;
  return (
    <div>
      <PageHeader title="Add worker" hi="नया मज़दूर" back="/workers" />
      <WorkerForm siteId={site.id} />
    </div>
  );
}
