import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { cashMoveSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { post } from "@/lib/ledger";
import { resolveSiteId } from "@/lib/site";
import { istDateKey, dateKeyToDate } from "@/lib/format";
import { randomUUID } from "crypto";

/**
 * Issue cash to somebody, take unspent cash back, or correct a balance.
 * Each of these also moves the site wallet, so the two stay in step.
 */
export const POST = withAuth("cash.move", async ({ user, req, ip }) => {
  const body = await parseBody(req, cashMoveSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const holder = await prisma.user.findFirst({ where: { id: body.holderId, active: true } });
  if (!holder) throw new ApiError(404, "Person not found");
  if (body.kind !== "ADJUSTMENT" && body.amount <= 0) throw new ApiError(400, "Amount must be more than 0");

  const sourceId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await post(tx, {
      siteId,
      holderId: holder.id,
      kind: body.kind,
      magnitude: body.amount,
      sourceType: "manual",
      sourceId,
      memo: body.memo || null,
      createdById: user.id,
    });
    const type = body.kind === "RETURN" ? "RETURN" : body.kind === "ADJUSTMENT" ? "ADJUSTMENT" : "TOPUP";
    await tx.pettyCashTxn.create({
      data: {
        siteId,
        date: dateKeyToDate(istDateKey()),
        type,
        amount: Math.abs(body.amount),
        description:
          body.kind === "RETURN"
            ? `Cash returned by ${holder.name}${body.memo ? ` — ${body.memo}` : ""}`
            : body.kind === "ADJUSTMENT"
              ? `Correction for ${holder.name}${body.memo ? ` — ${body.memo}` : ""}`
              : `Cash given to ${holder.name}${body.memo ? ` — ${body.memo}` : ""}`,
        paidTo: holder.name,
        enteredById: user.id,
      },
    });
    await audit({ userId: user.id, siteId, action: "CREATE", entity: "CashLedger", entityId: sourceId, newValues: { holder: holder.name, ...body }, ip }, tx);
  });
  return ok({ ok: true }, 201);
});
