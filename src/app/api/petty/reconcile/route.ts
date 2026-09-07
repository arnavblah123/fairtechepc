import { withAuth, parseBody, ok } from "@/lib/api";
import { reconcileSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { pettyBalance } from "@/lib/petty";
import { dateKeyToDate } from "@/lib/format";

/** In-charge counts physical cash monthly; a mismatch with the app balance is flagged. */
export const POST = withAuth("petty.expense", async ({ user, req, ip }) => {
  const body = await parseBody(req, reconcileSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const appBalance = await pettyBalance(siteId);
  const month = dateKeyToDate(body.month.slice(0, 8) + "01");
  const rec = await prisma.pettyCashReconciliation.upsert({
    where: { siteId_month: { siteId, month } },
    update: { physicalCash: body.physicalCash, appBalance, note: body.note || null, enteredById: user.id },
    create: { siteId, month, physicalCash: body.physicalCash, appBalance, note: body.note || null, enteredById: user.id },
  });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "PettyCashReconciliation", entityId: rec.id, newValues: rec, ip });
  return ok({ id: rec.id, appBalance, difference: body.physicalCash - appBalance });
});
