/* eslint-disable no-console */
import { PrismaClient, Trade, WageType, ConsumableCategory, QtyUnit } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const STAGES: { name: string; unit: QtyUnit; plannedQty: number; plannedDays: number }[] = [
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

const ITEMS: { name: string; category: ConsumableCategory; unit: string; reorder: number; welding?: boolean; kgPerUnit?: number }[] = [
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

async function main() {
  const adminUsername = (process.env.SEED_ADMIN_USERNAME ?? "arnav").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe@123";

  // 1. Superadmin
  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      name: "Arnav Bansal",
      role: "SUPERADMIN",
    },
  });
  console.log(`Superadmin: ${admin.username}`);

  // 2. Site
  const site = await prisma.site.upsert({
    where: { code: "SITE" },
    update: {},
    create: {
      code: "SITE",
      name: "Fabrication Site 1",
      city: "Nagpur",
      address: "Plot 12, MIDC Industrial Area",
      pettyCashThreshold: 5000,
    },
  });
  console.log(`Site: ${site.name} (${site.code})`);

  // Sample site users
  const sampleUsers = [
    { username: "incharge", name: "Site In-charge (sample)", role: "SITE_INCHARGE" as const },
    { username: "supervisor", name: "Supervisor (sample)", role: "SUPERVISOR" as const },
  ];
  for (const u of sampleUsers) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, passwordHash: await bcrypt.hash("site123", 10), siteId: site.id },
    });
  }
  console.log("Sample users: incharge / supervisor (password: site123)");

  // 3. Job with 8 stages
  const jobNumber = `${site.code}-001`;
  let job = await prisma.job.findUnique({ where: { jobNumber } });
  if (!job) {
    job = await prisma.job.create({
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
        stages: {
          create: STAGES.map((s, i) => ({ ...s, sequence: i + 1, siteId: site.id })),
        },
      },
    });
    console.log(`Job: ${job.jobNumber} ${job.name} with ${STAGES.length} stages`);
  }

  // 4. Workers
  let seq = 1;
  for (const w of WORKERS) {
    const code = `W-${String(seq++).padStart(3, "0")}`;
    const existing = await prisma.worker.findUnique({ where: { siteId_code: { siteId: site.id, code } } });
    if (existing) continue;
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
  console.log(`Workers: ${WORKERS.length}`);

  // 5. Consumable item master + zero stock rows for the site
  for (const it of ITEMS) {
    const item = await prisma.consumableItem.upsert({
      where: { name: it.name },
      update: {},
      create: {
        name: it.name,
        category: it.category,
        unit: it.unit,
        reorderLevel: it.reorder,
        isWeldingConsumable: !!it.welding,
        kgPerUnit: it.kgPerUnit,
      },
    });
    await prisma.consumableStock.upsert({
      where: { siteId_itemId: { siteId: site.id, itemId: item.id } },
      update: {},
      create: { siteId: site.id, itemId: item.id, qtyOnHand: 0 },
    });
  }
  console.log(`Consumable items: ${ITEMS.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
