import { withAuth, parseBody, ok } from "@/lib/api";
import { advanceDecideSchema } from "@/lib/validation";
import { decideAdvance } from "@/lib/decisions";

/** Approved advances auto-deduct from the worker's next wage sheet. */
export const POST = withAuth<{ id: string }>("advance.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, advanceDecideSchema);
  await decideAdvance(params.id, body.decision, body.note || null, { id: user.id, ip });
  return ok({ ok: true });
});
