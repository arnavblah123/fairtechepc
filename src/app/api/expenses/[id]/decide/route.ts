import { withAuth, parseBody, ok } from "@/lib/api";
import { expenseDecideSchema } from "@/lib/validation";
import { decideExpenseLine } from "@/lib/decisions";

export const POST = withAuth<{ id: string }>("expense.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, expenseDecideSchema);
  await decideExpenseLine(params.id, body.decision, body.note || null, { id: user.id, ip });
  return ok({ ok: true });
});
