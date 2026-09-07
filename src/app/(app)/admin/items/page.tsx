import { requirePage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { ItemManager } from "./ItemManager";

export default async function ItemsPage() {
  await requirePage("consumable.approve");
  const items = await prisma.consumableItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return (
    <div>
      <PageHeader title="Item master" hi="आइटम सूची" back="/consumables" />
      <ItemManager
        items={items.map((i) => ({
          id: i.id, name: i.name, category: i.category, unit: i.unit,
          reorderLevel: Number(i.reorderLevel), isWeldingConsumable: i.isWeldingConsumable,
          kgPerUnit: i.kgPerUnit ? Number(i.kgPerUnit) : null, active: i.active,
        }))}
      />
    </div>
  );
}
