import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { pettySentSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { istDateKey, dateKeyToDate } from "@/lib/format";

/** Superadmin marks the money as sent; the wallet tops up. */
export const POST = withAuth<{ id: string }>("petty.approve", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, pettySentSchema);
  const r = await prisma.pettyCashRequest.findFirst({ where: { id: params.id, voidedAt: null } });
  if (!r) throw new ApiError(404, "Request not found");
  if (r.status !== "APPROVED") throw new ApiError(400, "Approve it first");
  await prisma.$transaction(async (tx) => {
    await tx.pettyCashRequest.update({ where: { id: r.id }, data: { status: "SENT", sentAt: new Date(), sentMode: body.mode, sentRef: body.ref || null } });
    await tx.pettyCashTxn.create({
      data: { siteId: r.siteId, date: dateKeyToDate(istDateKey()), type: "TOPUP", amount: r.amount, description: `Top-up (${body.mode}${body.ref ? " " + body.ref : ""}): ${r.reason}`, requestId: r.id, enteredById: user.id },
    });
    await audit({ userId: user.id, siteId: r.siteId, action: "UPDATE", entity: "PettyCashRequest", entityId: r.id, oldValues: r, newValues: { status: "SENT", mode: body.mode }, ip }, tx);
  });
  return ok({ ok: true });
});
