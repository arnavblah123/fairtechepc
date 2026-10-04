import { withAuth, parseBody, ok } from "@/lib/api";
import { billDecideSchema } from "@/lib/validation";
import { decideBill } from "@/lib/decisions";

/** Decide every undecided line of a bill in one tap. Already-approved lines are left alone. */
export const POST = withAuth<{ id: string }>("expense.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, billDecideSchema);
  const r = await decideBill(params.id, body.decision, body.note || null, { id: user.id, ip });
  return ok({ decided: r.decided });
});
