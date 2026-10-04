import { withAuth, parseBody, ok } from "@/lib/api";
import { consDecideSchema } from "@/lib/validation";
import { decideConsumableRequest } from "@/lib/decisions";

/** Superadmin approves (choosing factory or local purchase) or rejects. */
export const POST = withAuth<{ id: string }>("consumable.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, consDecideSchema);
  await decideConsumableRequest(params.id, body.decision, body.fulfilment, body.note || null, { id: user.id, ip });
  return ok({ ok: true });
});
