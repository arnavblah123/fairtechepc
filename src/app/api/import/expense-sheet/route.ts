import { z } from "zod";
import { withAuth, parseBody, ok, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveSiteId } from "@/lib/site";
import { BUNDLED_SHEETS, importExpenseSheet, SheetError } from "@/lib/expense-sheets";

const schema = z.object({
  sheetId: z.string().min(1),
  holderId: z.string().min(1),
  dryRun: z.boolean().optional(),
});

/**
 * Enter one of the bundled expense sheets (data/expense-sheets/) for a person.
 * Lines are always left PENDING here; approval stays a separate, deliberate
 * tap on the dashboard. Re-running is safe and only reports what is in.
 */
export const POST = withAuth("cash.move", async ({ user, req }) => {
  const body = await parseBody(req, schema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const sheet = BUNDLED_SHEETS.find((s) => s.id === body.sheetId);
  if (!sheet) throw new ApiError(404, "No such sheet in the app");
  const holder = await prisma.user.findFirst({ where: { id: body.holderId, active: true } });
  if (!holder) throw new ApiError(404, "Person not found");
  try {
    const report = await importExpenseSheet(prisma, sheet, { siteId, holderId: holder.id, enteredById: user.id, dryRun: body.dryRun });
    return ok(report, body.dryRun ? 200 : 201);
  } catch (e) {
    if (e instanceof SheetError) throw new ApiError(400, e.message);
    throw e;
  }
});
