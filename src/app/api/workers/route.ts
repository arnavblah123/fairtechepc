import { withAuth, parseBody, ok } from "@/lib/api";
import { workerSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { dateKeyToDate } from "@/lib/format";
import { Prisma } from "@prisma/client";

export const GET = withAuth("worker.view", async ({ user, req }) => {
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const workers = await prisma.worker.findMany({
    where: { siteId },
    orderBy: [{ active: "desc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, trade: true, wageType: true, contractorName: true, phone: true, active: true, photoUrl: true },
  });
  return ok({ workers });
});

export const POST = withAuth("worker.manage", async ({ user, req, ip }) => {
  const url = new URL(req.url);
  const body = await parseBody(req, workerSchema);
  const siteId = await resolveSiteId(user, url.searchParams.get("siteId"));
  for (let attempt = 0; ; attempt++) {
    try {
      const worker = await prisma.$transaction(async (tx) => {
        const count = await tx.worker.count({ where: { siteId } });
        const created = await tx.worker.create({
          data: {
            siteId,
            code: `W-${String(count + 1).padStart(3, "0")}`,
            name: body.name,
            phone: body.phone || null,
            trade: body.trade,
            joiningDate: dateKeyToDate(body.joiningDate),
            wageType: body.wageType,
            contractorName: body.contractorName || null,
            idDocRef: body.idDocRef || null,
            photoUrl: body.photoUrl || null,
          },
        });
        await audit({ userId: user.id, siteId, action: "CREATE", entity: "Worker", entityId: created.id, newValues: created, ip }, tx);
        return created;
      });
      return ok({ id: worker.id, code: worker.code }, 201);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
});
