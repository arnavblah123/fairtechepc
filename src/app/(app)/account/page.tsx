import { PageHeader } from "@/components/ui/PageHeader";
import { PasswordForm } from "./PasswordForm";

export default function AccountPage() {
  return (
    <div>
      <PageHeader title="Change password" hi="पासवर्ड बदलें" back="/more" />
      <PasswordForm />
    </div>
  );
}
