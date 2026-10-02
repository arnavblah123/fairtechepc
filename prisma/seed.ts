/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seed-data";

const prisma = new PrismaClient();

runSeed(prisma, {
  adminUsername: process.env.SEED_ADMIN_USERNAME ?? "arnav",
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe@123",
  site: { name: process.env.SEED_SITE_NAME ?? "Main Site", city: process.env.SEED_SITE_CITY ?? "" },
  log: console.log,
})
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
