import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { indentSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { dateKeyToDate } from "@/lib/format";
import { Prisma } from "@prisma/client";

/** Everything the site needs, asked for in one go. Each item becomes its own request line. */
export const POST = withAuth("consumable.request", async ({ user, req, ip }) => {
  const body = await parseBody(req, indentSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const ids = [...new Set(body.items.map((i) => i.itemId))];
  if (ids.length !== body.items.length) throw new ApiError(400, "The same item is listed twice");
  const found = await prisma.consumableItem.count({ where: { id: { in: ids }, active: true } });
  if (found !== ids.length) throw new ApiError(400, "One of the items no longer exists");

  for (let attempt = 0; ; attempt++) {
    try {
      const indent = await prisma.$transaction(async (tx) => {
        const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { code: true } });
        const count = await tx.materialIndent.count({ where: { siteId } });
        const created = await tx.materialIndent.create({
          data: {
            siteId,
            indentNo: `${site.code}-IND-${String(count + 1).padStart(3, "0")}`,
            reason: body.reason,
            neededBy: dateKeyToDate(body.neededBy),
            note: body.note || null,
            requestedById: user.id,
            lines: {
              create: body.items.map((i) => ({ siteId, itemId: i.itemId, qty: i.qty, reason: body.reason, neededBy: dateKeyToDate(body.neededBy), requestedById: user.id })),
            },
          },
        });
        await audit({ userId: user.id, siteId, action: "CREATE", entity: "MaterialIndent", entityId: created.id, newValues: { indentNo: created.indentNo, items: body.items.length, reason: body.reason }, ip }, tx);
        return created;
      });
      return ok({ id: indent.id, indentNo: indent.indentNo }, 201);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
});
