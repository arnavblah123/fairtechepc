// Build script used by Vercel and `npm run build`.
// 1. Falls back DIRECT_URL -> DATABASE_URL_UNPOOLED -> DATABASE_URL so the Vercel Neon
//    integration (which only sets DATABASE_URL*) works without manual env setup.
// 2. Applies pending migrations before building. If no database is configured yet the
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
} else {
  console.warn("\n[build] DATABASE_URL is not set: skipping migrations. Add a database and redeploy.\n");
}
run("npx", ["next", "build"]);
