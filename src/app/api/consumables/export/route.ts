import { withAuth, csvResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveSiteId } from "@/lib/site";
import { titleCase } from "@/lib/format";

export const GET = withAuth("export.csv", async ({ user, req }) => {
  const siteId = await resolveSiteId(user, new URL(req.url).searchParams.get("siteId"));
  const stock = await prisma.consumableStock.findMany({ where: { siteId }, include: { item: true }, orderBy: { item: { name: "asc" } } });
  return csvResponse(
    "stock.csv",
    stock.map((s) => ({
      Item: s.item.name,
      Category: titleCase(s.item.category),
      Unit: s.item.unit,
      "On hand": Number(s.qtyOnHand),
      "Reorder level": Number(s.item.reorderLevel),
      Low: Number(s.qtyOnHand) <= Number(s.item.reorderLevel) ? "YES" : "",
    })),
  );
});
