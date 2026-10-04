import { withAuth, parseBody, ok } from "@/lib/api";
import { itemDecideSchema } from "@/lib/validation";
import { decideItem } from "@/lib/decisions";

/** Superadmin accepts a site-added item into the master, or rejects it (deactivates). */
export const POST = withAuth<{ id: string }>("item.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, itemDecideSchema);
  await decideItem(params.id, body.decision, body.note || null, { id: user.id, ip });
  return ok({ ok: true });
});
