// Build script used by Vercel and `npm run build`.
// 1. Falls back DIRECT_URL -> DATABASE_URL_UNPOOLED -> DATABASE_URL so the Vercel Neon
//    integration (which only sets DATABASE_URL*) works without manual env setup.
// 2. Applies pending migrations and enters bundled expense sheets before building. If no database is configured yet the
//    build still succeeds so the first Vercel deploy is green; the app then shows setup help.
import { spawnSync } from "node:child_process";

// Local runs: pick up .env (Vercel injects real env vars, so this is a no-op there).
try {
  process.loadEnvFile?.(".env");
} catch {}

const env = { ...process.env };
env.DIRECT_URL ||= env.DATABASE_URL_UNPOOLED || env.DATABASE_URL || "";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npx", ["prisma", "generate"]);
if (env.DATABASE_URL) {
  run("npx", ["prisma", "migrate", "deploy"]);
  // 3. Enter the expense sheets shipped in data/expense-sheets/ (pending, never approved).
  //    Idempotent, and a problem here only prints: it must never fail the deploy.
  const r = spawnSync("npx", ["tsx", "scripts/import-expense-sheet.ts", "--bundled"], { stdio: "inherit", env, shell: process.platform === "win32" });
  if (r.status !== 0) console.warn("\n[build] bundled expense sheets were not entered (see above); they can be entered from More → Admin.\n");
} else {
  console.warn("\n[build] DATABASE_URL is not set: skipping migrations. Add a database and redeploy.\n");
}
run("npx", ["next", "build"]);
