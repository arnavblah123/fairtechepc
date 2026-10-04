import { withAuth, parseBody, ok } from "@/lib/api";
import { indentDecideSchema } from "@/lib/validation";
import { decideIndent } from "@/lib/decisions";

/** Decide every still-pending line of an indent at once. Lines already decided are left alone. */
export const POST = withAuth<{ id: string }>("consumable.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, indentDecideSchema);
  const r = await decideIndent(params.id, body.decision, body.fulfilment, body.note || null, { id: user.id, ip });
  return ok({ decided: r.decided });
});
