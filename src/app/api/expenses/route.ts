import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { expenseEntrySchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { assertEditableDate } from "@/lib/dates-guard";
import { dateKeyToDate } from "@/lib/format";
import { normalizePartyName } from "@/lib/parties";

export const GET = withAuth("expense.view", async ({ user, req }) => {
  const url = new URL(req.url);
  const siteId = await resolveSiteId(user, url.searchParams.get("siteId"));
  const status = url.searchParams.get("status");
  const expenses = await prisma.expense.findMany({
    where: {
      siteId,
      voidedAt: null,
      ...(status ? { status: status as "PENDING" } : {}),
      // Site staff see their own entries; the office sees everything.
      ...(user.role === "SUPERADMIN" || user.role === "SITE_INCHARGE" ? {} : { spentById: user.id }),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { category: true, spentBy: { select: { name: true } }, job: { select: { jobNumber: true } } },
  });
  return ok({ expenses });
});

/**
 * Record a spend. It counts against nobody's cash until the superadmin approves
 * it, which is what posts the ledger row.
 */
export const POST = withAuth("expense.create", async ({ user, req, ip }) => {
  const body = await parseBody(req, expenseEntrySchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  await assertEditableDate(user, siteId, "EXPENSES", body.date);

  const category = await prisma.expenseCategory.findFirst({ where: { id: body.categoryId, active: true } });
  if (!category) throw new ApiError(400, "Category not found");
  // Only a purchase is expected to have a bill — a payment to a labourer has none.
  if (body.entryType === "PURCHASE" && !body.billPhotoUrl) {
    throw new ApiError(400, "A purchase needs a bill photo / खरीद की बिल फोटो ज़रूरी है");
  }
  if (category.requiresPerson && !body.workerId) throw new ApiError(400, "Choose which worker this was for");
  if (category.requiresMachine && !body.machineId) throw new ApiError(400, "Choose which machine this was for");
  if (category.requiresMachine && !(body.problem ?? "").trim()) throw new ApiError(400, "Say what was wrong with the machine");

  // Only the office may book spending against somebody else's cash.
  const spentById = body.spentById && user.role === "SUPERADMIN" ? body.spentById : user.id;

  const partyId = body.payeeText?.trim()
    ? (
        await prisma.party.upsert({
          where: { siteId_normalizedName: { siteId, normalizedName: normalizePartyName(body.payeeText) } },
          update: {},
          create: {
            siteId,
            name: body.payeeText.trim(),
            normalizedName: normalizePartyName(body.payeeText),
            kind: category.requiresPerson ? "LABOUR" : "VENDOR",
          },
        })
      ).id
    : null;

  const expense = await prisma.expense.create({
    data: {
      siteId,
      date: dateKeyToDate(body.date),
      amount: body.amount,
      categoryId: category.id,
      entryType: body.entryType,
      paidFrom: body.paidFrom,
      description: body.description,
      note: body.note || null,
      jobId: body.jobId || null,
      partyId,
      payeeText: body.payeeText || null,
      workerId: body.workerId || null,
      machineId: body.machineId || null,
      problem: body.problem || null,
      solution: body.solution || null,
      billPhotoUrl: body.billPhotoUrl || null,
      spentById,
      enteredById: user.id,
    },
  });
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "Expense", entityId: expense.id, newValues: expense, ip });
  return ok({ id: expense.id }, 201);
});
