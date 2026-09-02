import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Card";

export default function AttendancePlaceholder() {
  return (
    <div>
      <PageHeader title="Attendance" hi="हाज़िरी" />
      <EmptyState en="Attendance arrives in Phase 2." hi="हाज़िरी फेज़ 2 में आएगी।" />
    </div>
  );
}
