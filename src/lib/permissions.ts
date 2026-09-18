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
  "record.delete": ["SUPERADMIN"], // delete/void any record, with a reason, always logged
  // jobs
  "job.view": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR", "PURCHASE", "VIEWER"],
  "job.manage": ["SUPERADMIN"],
  "stage.manage": ["SUPERADMIN"],
  "stage.progress": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR"],
  "material.plan": ["SUPERADMIN", "SITE_INCHARGE"], // consumables decided up front for a job
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
  "consumable.view": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR", "PURCHASE", "VIEWER"],
  "consumable.consume": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR"],
  "consumable.request": ["SITE_INCHARGE", "SUPERVISOR"],
  "consumable.approve": ["SUPERADMIN"],
  "consumable.order": ["PURCHASE", "SUPERADMIN"], // purchase desk in Pune places the order
  "consumable.dispatch": ["SUPERADMIN", "PURCHASE"],
  "consumable.receive": ["SITE_INCHARGE", "SUPERVISOR"], // inward + acceptance at site
  "item.manage": ["SUPERADMIN", "PURCHASE"],
  // machines
  "machine.view": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR", "VIEWER"],
  "machine.dispatch": ["SUPERADMIN"],
  "machine.receive": ["SITE_INCHARGE", "SUPERVISOR"],
  "machine.ticket": ["SUPERVISOR", "SITE_INCHARGE"],
  // petty cash expenses
  "expense.view": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR", "VIEWER"],
  "expense.create": ["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR"],
  "expense.approve": ["SUPERADMIN"],
  "cash.view": ["SUPERADMIN"], // who is holding how much
  "cash.move": ["SUPERADMIN"], // issue, take back or correct someone's cash
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
  PURCHASE: { en: "Purchase (Pune)", hi: "परचेज़ (पुणे)" },
  VIEWER: { en: "Viewer", hi: "केवल देखने वाला" },
};

/** Roles that work at head office and are not tied to a site. */
export const HEAD_OFFICE_ROLES: Role[] = ["SUPERADMIN", "PURCHASE"];
export function isHeadOffice(role: Role) {
  return HEAD_OFFICE_ROLES.includes(role);
}
