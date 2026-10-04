import { withAuth, parseBody, ok } from "@/lib/api";
import { pettyDecideSchema } from "@/lib/validation";
import { decidePettyRequest } from "@/lib/decisions";

export const POST = withAuth<{ id: string }>("petty.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, pettyDecideSchema);
  await decidePettyRequest(params.id, body.decision, body.note || null, { id: user.id, ip });
  return ok({ ok: true });
});
