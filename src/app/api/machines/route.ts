import { withAuth, parseBody, ok } from "@/lib/api";
import { machineSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export const GET = withAuth("dpr.view", async ({ user, req }) => {
  const url = new URL(req.url);
  // Superadmin sees all machines; site roles only their site's.
  const where = user.role === "SUPERADMIN" ? (url.searchParams.get("siteId") ? { siteId: url.searchParams.get("siteId") } : {}) : { siteId: user.siteId ?? "-" };
  const machines = await prisma.machine.findMany({ where: { active: true, ...where }, orderBy: { machineNumber: "asc" }, include: { site: { select: { code: true } } } });
  return ok({ machines });
});

/** Superadmin adds a machine to the factory register (auto number M-001…). */
export const POST = withAuth("machine.dispatch", async ({ user, req, ip }) => {
  const body = await parseBody(req, machineSchema);
  for (let attempt = 0; ; attempt++) {
    try {
      const machine = await prisma.$transaction(async (tx) => {
        const count = await tx.machine.count();
        const created = await tx.machine.create({
          data: { machineNumber: `M-${String(count + 1).padStart(3, "0")}`, type: body.type, make: body.make || null, model: body.model || null, serialNo: body.serialNo || null },
        });
        await audit({ userId: user.id, action: "CREATE", entity: "Machine", entityId: created.id, newValues: created, ip }, tx);
        return created;
      });
      return ok({ id: machine.id, machineNumber: machine.machineNumber }, 201);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
});
