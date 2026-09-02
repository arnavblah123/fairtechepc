import type { Role } from "@prisma/client";

/**
 * Single source of truth for what each role may do.
 * UI hides anything the role cannot do; API routes call `can()` again server-side.
 */
export const CAPABILITIES = {
  // admin
  "user.manage": ["SUPERADMIN"],
  "site.manage": ["SUPERADMIN"],
  "audit.view": ["SUPERADMIN"],
  "export.csv": ["SUPERADMIN"],
  "backdate.unlock": ["SUPERADMIN"],
  // jobs
  "job.view": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR", "VIEWER"],
  "job.manage": ["SUPERADMIN"],
  "stage.manage": ["SUPERADMIN"],
  "stage.progress": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR"],
  // labour
  "worker.view": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR", "VIEWER"],
  "worker.manage": ["SUPERADMIN", "SITE_INCHARGE"],
  "attendance.mark": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR"],
  "holiday.manage": ["SUPERADMIN"],
  "wage.rate": ["SUPERADMIN"],
  "wage.view": ["SUPERADMIN"],
  "advance.request": ["SITE_INCHARGE", "SUPERVISOR"],
  "advance.approve": ["SUPERADMIN"],
  // daily
  "plan.submit": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR"],
  "dpr.submit": ["SUPERADMIN", "SITE_INCHARGE"],
  "dpr.view": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR", "VIEWER"],
  "photo.upload": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR"],
  "issue.raise": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR"],
  "issue.resolve": ["SUPERADMIN", "SITE_INCHARGE"],
  // consumables
  "consumable.consume": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR"],
  "consumable.request": ["SITE_INCHARGE", "SUPERVISOR"],
  "consumable.approve": ["SUPERADMIN"],
  "consumable.dispatch": ["SUPERADMIN"],
  "consumable.receive": ["SITE_INCHARGE", "SUPERVISOR"],
  // machines
  "machine.dispatch": ["SUPERADMIN"],
  "machine.receive": ["SITE_INCHARGE", "SUPERVISOR"],
  "machine.ticket": ["SUPERVISOR", "SITE_INCHARGE"],
  // money
  "petty.request": ["SITE_INCHARGE", "SUPERVISOR"],
  "petty.approve": ["SUPERADMIN"],
  "petty.expense": ["SITE_INCHARGE"],
  "money.view": ["SUPERADMIN"],
  "dashboard.admin": ["SUPERADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES[cap] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, { en: string; hi: string }> = {
  SUPERADMIN: { en: "Superadmin", hi: "सुपर एडमिन" },
  SITE_INCHARGE: { en: "Site In-charge", hi: "साइट इंचार्ज" },
  SUPERVISOR: { en: "Supervisor", hi: "सुपरवाइज़र" },
  VIEWER: { en: "Viewer", hi: "केवल देखने वाला" },
};
