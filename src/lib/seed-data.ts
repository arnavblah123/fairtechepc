// Shared by prisma/seed.ts (CLI) and /api/setup (first-run page in the app).
// No Next.js imports here.
import type { PrismaClient, ConsumableCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

export const ITEM_MASTER: { name: string; category: ConsumableCategory; unit: string; reorder: number; welding?: boolean; kgPerUnit?: number }[] = [
  { name: "Electrode E6013 2.5mm", category: "WELDING_ELECTRODE", unit: "kg", reorder: 20, welding: true, kgPerUnit: 1 },
  { name: "Electrode E6013 3.15mm", category: "WELDING_ELECTRODE", unit: "kg", reorder: 40, welding: true, kgPerUnit: 1 },
  { name: "Electrode E6013 4mm", category: "WELDING_ELECTRODE", unit: "kg", reorder: 40, welding: true, kgPerUnit: 1 },
  { name: "Electrode E7018 3.15mm", category: "WELDING_ELECTRODE", unit: "kg", reorder: 40, welding: true, kgPerUnit: 1 },
  { name: "Electrode E7018 4mm", category: "WELDING_ELECTRODE", unit: "kg", reorder: 40, welding: true, kgPerUnit: 1 },
  { name: "MIG Wire ER70S-6 1.2mm (15kg spool)", category: "MIG_WIRE", unit: "spool", reorder: 4, welding: true, kgPerUnit: 15 },
  { name: "CO2 Gas Cylinder", category: "GAS", unit: "cylinder", reorder: 2 },
  { name: "Oxygen Cylinder", category: "GAS", unit: "cylinder", reorder: 3 },
  { name: "LPG Cylinder (19kg)", category: "GAS", unit: "cylinder", reorder: 2 },
  { name: "DA (Acetylene) Cylinder", category: "GAS", unit: "cylinder", reorder: 2 },
  { name: "Grinding Wheel 7 inch", category: "GRINDING", unit: "nos", reorder: 20 },
  { name: "Grinding Wheel 4 inch", category: "GRINDING", unit: "nos", reorder: 20 },
  { name: "Cutting Wheel 4 inch", category: "CUTTING", unit: "nos", reorder: 30 },
  { name: "Cutting Wheel 14 inch", category: "CUTTING", unit: "nos", reorder: 10 },
  { name: "Flap Disc 4 inch", category: "GRINDING", unit: "nos", reorder: 20 },
  { name: "Chipping Hammer", category: "HAND_TOOL", unit: "nos", reorder: 2 },
  { name: "Wire Brush", category: "HAND_TOOL", unit: "nos", reorder: 5 },
  { name: "Welding Glass (black)", category: "PPE_SAFETY", unit: "nos", reorder: 10 },
  { name: "Welding Gloves (leather)", category: "PPE_SAFETY", unit: "pair", reorder: 10 },
  { name: "Cotton Hand Gloves", category: "PPE_SAFETY", unit: "pair", reorder: 20 },
  { name: "Safety Helmet", category: "PPE_SAFETY", unit: "nos", reorder: 5 },
  { name: "Safety Goggles", category: "PPE_SAFETY", unit: "nos", reorder: 10 },
  { name: "Red Oxide Primer", category: "PAINT", unit: "litre", reorder: 40 },
  { name: "Enamel Paint (Grey)", category: "PAINT", unit: "litre", reorder: 40 },
  { name: "Thinner", category: "PAINT", unit: "litre", reorder: 20 },
  { name: "Nuts & Bolts M16", category: "HARDWARE", unit: "nos", reorder: 100 },
  { name: "Nuts & Bolts M20", category: "HARDWARE", unit: "nos", reorder: 100 },
];

/**
 * Spend categories. `requiresPerson` shows the labour picker so per-person
 * totals group properly instead of splitting across spellings; `requiresMachine`
 * asks which machine and what was wrong, so repair cost traces to the machine.
 */
export const EXPENSE_CATEGORIES = [
  { slug: "material", name: "Material", requiresPerson: false, requiresMachine: false, sortOrder: 10 },
  { slug: "labour-advance", name: "Labour advance", requiresPerson: true, requiresMachine: false, sortOrder: 20 },
  { slug: "night-payment", name: "Night payment", requiresPerson: true, requiresMachine: false, sortOrder: 30 },
  { slug: "transport", name: "Transport", requiresPerson: false, requiresMachine: false, sortOrder: 40 },
  { slug: "food", name: "Food / tea", requiresPerson: false, requiresMachine: false, sortOrder: 50 },
  { slug: "fuel", name: "Fuel", requiresPerson: false, requiresMachine: false, sortOrder: 60 },
  { slug: "tools", name: "Tools", requiresPerson: false, requiresMachine: false, sortOrder: 70 },
  { slug: "machine-maintenance", name: "Machine repair / maintenance", requiresPerson: false, requiresMachine: true, sortOrder: 75 },
  { slug: "consumables", name: "Consumables", requiresPerson: false, requiresMachine: false, sortOrder: 78 },
  { slug: "medical", name: "Medical", requiresPerson: false, requiresMachine: false, sortOrder: 80 },
  { slug: "rent", name: "Rent", requiresPerson: false, requiresMachine: false, sortOrder: 85 },
  { slug: "miscellaneous", name: "Miscellaneous", requiresPerson: false, requiresMachine: false, sortOrder: 90 },
];

export type SeedOptions = {
  adminUsername: string;
  adminPassword: string;
  adminName?: string;
  /** The one real site. Nothing sample is created. */
  site: { name: string; city: string; code?: string };
  log?: (msg: string) => void;
};

/** Idempotent: safe to run again, existing rows are left untouched. */
export async function runSeed(prisma: PrismaClient, opts: SeedOptions) {
  const log = opts.log ?? (() => {});

  const admin = await prisma.user.upsert({
    where: { username: opts.adminUsername.toLowerCase() },
    update: {},
    create: {
      username: opts.adminUsername.toLowerCase(),
      passwordHash: await bcrypt.hash(opts.adminPassword, 10),
      name: opts.adminName ?? "Arnav Bansal",
      role: "SUPERADMIN",
    },
  });
  log(`Superadmin: ${admin.username}`);

  // Item master is useful even without sample data.
  for (const it of ITEM_MASTER) {
    await prisma.consumableItem.upsert({
      where: { name: it.name },
      update: {},
      create: { name: it.name, category: it.category, unit: it.unit, reorderLevel: it.reorder, isWeldingConsumable: !!it.welding, kgPerUnit: it.kgPerUnit },
    });
  }
  log(`Consumable items: ${ITEM_MASTER.length}`);

  for (const c of EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  log(`Expense categories: ${EXPENSE_CATEGORIES.length}`);

  // Site code is derived from the name (first letters, up to 4) unless given; it prefixes job numbers.
  const code = (opts.site.code ?? opts.site.name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 4).toUpperCase()) || "SITE";
  const existing = await prisma.site.findFirst({ where: { active: true } });
  const site = existing ?? (await prisma.site.create({ data: { code, name: opts.site.name, city: opts.site.city, pettyCashThreshold: 5000 } }));
  log(`Site: ${site.name}, ${site.city} (${site.code})`);

  for (const it of ITEM_MASTER) {
    const item = await prisma.consumableItem.findUniqueOrThrow({ where: { name: it.name } });
    await prisma.consumableStock.upsert({ where: { siteId_itemId: { siteId: site.id, itemId: item.id } }, update: {}, create: { siteId: site.id, itemId: item.id, qtyOnHand: 0 } });
  }
  return { admin, site };
}
