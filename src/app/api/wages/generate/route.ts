import { withAuth, parseBody, ok } from "@/lib/api";
import { wageGenerateSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { resolveSiteId } from "@/lib/site";
import { generateWageSheets } from "@/lib/wages";

export const POST = withAuth("wage.view", async ({ user, req, ip }) => {
  const body = await parseBody(req, wageGenerateSchema);
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const result = await generateWageSheets(siteId, body.period, body.start, user.id);
  await audit({ userId: user.id, siteId, action: "CREATE", entity: "WageSheet", newValues: { period: body.period, start: body.start, ...result }, ip });
  return ok(result, 201);
});
