// Shared by prisma/seed.ts (CLI) and /api/setup (first-run page in the app).
// No Next.js imports here.
import type { PrismaClient, Trade, WageType, ConsumableCategory, QtyUnit } from "@prisma/client";
import bcrypt from "bcryptjs";

export const SAMPLE_STAGES: { name: string; unit: QtyUnit; plannedQty: number; plannedDays: number }[] = [
  { name: "Marking", unit: "MT", plannedQty: 120, plannedDays: 10 },
  { name: "Cutting", unit: "MT", plannedQty: 120, plannedDays: 12 },
  { name: "Fit-up", unit: "MT", plannedQty: 120, plannedDays: 20 },
  { name: "Welding", unit: "MT", plannedQty: 120, plannedDays: 25 },
  { name: "Grinding", unit: "MT", plannedQty: 120, plannedDays: 10 },
  { name: "Inspection", unit: "MT", plannedQty: 120, plannedDays: 6 },
  { name: "Blasting/Painting", unit: "SQM", plannedQty: 2400, plannedDays: 12 },
  { name: "Dispatch/Erection", unit: "MT", plannedQty: 120, plannedDays: 15 },
];

const WORKERS: { name: string; trade: Trade; wageType: WageType; rate: number; contractor?: string }[] = [
  { name: "Ramesh Yadav", trade: "FITTER", wageType: "PER_DAY", rate: 750 },
  { name: "Suresh Kumar", trade: "FITTER", wageType: "PER_DAY", rate: 750 },
  { name: "Manoj Sharma", trade: "WELDER", wageType: "PER_DAY", rate: 850 },
  { name: "Dinesh Prasad", trade: "WELDER", wageType: "PER_DAY", rate: 850 },
  { name: "Rakesh Singh", trade: "WELDER", wageType: "PER_HOUR", rate: 110 },
  { name: "Vinod Paswan", trade: "GRINDER", wageType: "PER_DAY", rate: 600 },
  { name: "Santosh Mahto", trade: "GRINDER", wageType: "PER_DAY", rate: 600 },
  { name: "Ajay Verma", trade: "GAS_CUTTER", wageType: "PER_DAY", rate: 700 },
  { name: "Mukesh Rai", trade: "GAS_CUTTER", wageType: "PER_DAY", rate: 700 },
  { name: "Sonu Kumar", trade: "HELPER", wageType: "PER_DAY", rate: 450, contractor: "Verma Labour Supply" },
  { name: "Pappu Ram", trade: "HELPER", wageType: "PER_DAY", rate: 450, contractor: "Verma Labour Supply" },
  { name: "Raju Das", trade: "HELPER", wageType: "PER_DAY", rate: 450, contractor: "Verma Labour Supply" },
  { name: "Bablu Mandal", trade: "RIGGER", wageType: "PER_DAY", rate: 800 },
  { name: "Anil Thakur", trade: "PAINTER", wageType: "PER_DAY", rate: 650 },
  { name: "Ganesh Pawar", trade: "PAINTER", wageType: "PER_DAY", rate: 650 },
];

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

function date(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d));
}

export type SeedOptions = {
  adminUsername: string;
  adminPassword: string;
  adminName?: string;
  /** Create a sample site, job with 8 stages, 15 workers and sample site users. */
  sampleData: boolean;
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

  if (!opts.sampleData) return { admin };

  const site = await prisma.site.upsert({
    where: { code: "SITE" },
    update: {},
    create: { code: "SITE", name: "Fabrication Site 1", city: "Nagpur", address: "Plot 12, MIDC Industrial Area", pettyCashThreshold: 5000 },
  });
  log(`Site: ${site.name} (${site.code})`);

  for (const u of [
    { username: "incharge", name: "Site In-charge (sample)", role: "SITE_INCHARGE" as const },
    { username: "supervisor", name: "Supervisor (sample)", role: "SUPERVISOR" as const },
  ]) {
    await prisma.user.upsert({ where: { username: u.username }, update: {}, create: { ...u, passwordHash: await bcrypt.hash("site123", 10), siteId: site.id } });
  }
  log("Sample users: incharge / supervisor (password: site123)");

  const jobNumber = `${site.code}-001`;
  if (!(await prisma.job.findUnique({ where: { jobNumber } }))) {
    await prisma.job.create({
      data: {
        siteId: site.id,
        jobNumber,
        name: "Boiler Support Structure",
        clientName: "Sample Client Ltd",
        description: "Fabrication of columns, beams and bracings for boiler support structure.",
        drawingRef: "DWG-BSS-001 to 014",
        plannedTonnage: 120,
        plannedStart: date(2026, 9, 1),
        plannedEnd: date(2026, 12, 15),
        weldingNormKgPerMT: 12,
        createdById: admin.id,
        stages: { create: SAMPLE_STAGES.map((s, i) => ({ ...s, sequence: i + 1, siteId: site.id })) },
      },
    });
    log(`Job: ${jobNumber} Boiler Support Structure with ${SAMPLE_STAGES.length} stages`);
  }

  let seq = 1;
  for (const w of WORKERS) {
    const code = `W-${String(seq++).padStart(3, "0")}`;
    if (await prisma.worker.findUnique({ where: { siteId_code: { siteId: site.id, code } } })) continue;
    await prisma.worker.create({
      data: {
        siteId: site.id,
        code,
        name: w.name,
        trade: w.trade,
        wageType: w.wageType,
        contractorName: w.contractor,
        joiningDate: date(2026, 9, 1),
        wageRates: { create: { rate: w.rate, effectiveFrom: date(2026, 9, 1), setById: admin.id } },
      },
    });
  }
  log(`Workers: ${WORKERS.length}`);

  for (const it of ITEM_MASTER) {
    const item = await prisma.consumableItem.findUniqueOrThrow({ where: { name: it.name } });
    await prisma.consumableStock.upsert({ where: { siteId_itemId: { siteId: site.id, itemId: item.id } }, update: {}, create: { siteId: site.id, itemId: item.id, qtyOnHand: 0 } });
  }
  return { admin, site };
}
