import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { wageRateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { dateKeyToDate } from "@/lib/format";

/** Superadmin only: set a new wage rate effective from a date. History is kept. */
export const POST = withAuth<{ id: string }>("wage.rate", async ({ user, req, params, ip }) => {
  const body = await parseBody(req, wageRateSchema);
  const worker = await prisma.worker.findUnique({ where: { id: params.id } });
  if (!worker) throw new ApiError(404, "Worker not found");
  const rate = await prisma.wageRate.create({
    data: { workerId: worker.id, rate: body.rate, otRate: body.otRate ?? null, effectiveFrom: dateKeyToDate(body.effectiveFrom), setById: user.id },
  });
  await audit({ userId: user.id, siteId: worker.siteId, action: "CREATE", entity: "WageRate", entityId: rate.id, newValues: rate, ip });
  return ok({ id: rate.id }, 201);
});

export const GET = withAuth<{ id: string }>("wage.rate", async ({ params }) => {
  const rates = await prisma.wageRate.findMany({ where: { workerId: params.id }, orderBy: { effectiveFrom: "desc" }, include: { setBy: { select: { name: true } } } });
  return ok({ rates });
});
