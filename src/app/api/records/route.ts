import { z } from "zod";
import { withAuth, parseBody, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { DELETABLE, deleteRecord, type DeletableEntity } from "@/lib/deletable";

const schema = z.object({
  entity: z.string().refine((v): v is DeletableEntity => v in DELETABLE, "Unknown record type"),
  id: z.string().min(1),
  reason: z.string().trim().min(3, "Give a reason").max(300),
});

/**
 * Delete (void) any record. Superadmin only, reason required, always audited —
 * so a deleted record can still be traced later.
 */
export const POST = withAuth("record.delete", async ({ user, req, ip }) => {
  const body = await parseBody(req, schema);
  const { siteId, label } = await deleteRecord(body.entity, body.id, body.reason);
  await audit({ userId: user.id, siteId, action: "VOID", entity: body.entity, entityId: body.id, newValues: { reason: body.reason }, ip });
  return ok({ ok: true, label });
});
