/* eslint-disable no-console */
/**
 * Import a hand-kept expense sheet (the Excel a supervisor sends after a trip)
 * into the app from the command line. The same import runs from the phone at
 * More → Admin → Import expense sheet for the sheets bundled with the app; this
 * script is for any sheet file, and is the only way to approve on the spot.
 *
 *   - every cash the person received  -> a row in their cash-in-hand ledger
 *                                        (ADVANCE / TOPUP) plus the site cash book
 *   - every line they spent            -> an Expense charged to that person,
 *                                        PENDING until the superadmin approves it
 *   - with --approve                   -> approved on the spot, which debits the
 *                                        ledger exactly as a tap in the app would
 *
 * Safe to run twice: cash rows carry a fixed posting key and every expense
 * carries a sheet marker in its note, so a re-run only reports what is there.
 *
 *   npx tsx scripts/import-expense-sheet.ts data/expense-sheets/<sheet>.json \
 *       --site <site code or name> --holder <username> [--as <superadmin username>] \
 *       [--approve] [--dry-run] [--create-holder --username <u> --password <p>]
 *
 * The deploy runs it as `--bundled`: every sheet shipped in BUNDLED_SHEETS is
 * entered (pending) for the login whose name matches the sheet, creating a
 * supervisor login for them when there is none. Nothing there ever fails the
 * build; problems are printed and the sheet stays available on the phone.
 *
 * Needs DATABASE_URL (read from .env when present).
 */
import { PrismaClient, type Site, type User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatDate } from "../src/lib/format";
import { normalizePartyName } from "../src/lib/parties";
import { BUNDLED_SHEETS, importExpenseSheet, SheetError, sheetStatus, validateSheet, type ExpenseSheet } from "../src/lib/expense-sheets";
import { randomBytes } from "node:crypto";

try {
  process.loadEnvFile?.(".env");
} catch {}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

type Args = { file: string; bundled: boolean; site?: string; holder?: string; as?: string; approve: boolean; dryRun: boolean; createHolder: boolean; username?: string; password?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { file: "", bundled: false, approve: false, dryRun: false, createHolder: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) fail(`${a} needs a value`);
      return v;
    };
    if (a === "--site") args.site = next();
    else if (a === "--holder") args.holder = next();
    else if (a === "--as") args.as = next();
    else if (a === "--username") args.username = next();
    else if (a === "--password") args.password = next();
    else if (a === "--approve") args.approve = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--create-holder") args.createHolder = true;
    else if (a === "--bundled") args.bundled = true;
    else if (a.startsWith("--")) fail(`Unknown option ${a}`);
    else if (!args.file) args.file = a;
    else fail(`Unexpected argument ${a}`);
  }
  if (!args.file && !args.bundled) fail("Usage: tsx scripts/import-expense-sheet.ts <sheet.json> --site <code|name> --holder <username> [--as <superadmin>] [--approve] [--dry-run]   or   --bundled");
  return args;
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function readSheet(path: string): ExpenseSheet {
  try {
    return validateSheet(JSON.parse(readFileSync(resolve(path), "utf8")));
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

async function pickSite(prisma: PrismaClient, wanted: string | undefined): Promise<Site> {
  const sites = await prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  if (sites.length === 0) fail("No active site in the database. Run the app's /setup page first.");
  if (!wanted) {
    if (sites.length === 1) return sites[0];
    fail(`Several sites exist, choose one with --site:\n${sites.map((s) => `  ${s.code}  ${s.name} (${s.city})`).join("\n")}`);
  }
  const w = wanted.trim().toLowerCase();
  const site = sites.find((s) => s.code.toLowerCase() === w) ?? sites.find((s) => s.name.toLowerCase() === w) ?? sites.filter((s) => s.name.toLowerCase().includes(w));
  const hit = Array.isArray(site) ? (site.length === 1 ? site[0] : undefined) : site;
  if (!hit) fail(`No single site matches "${wanted}". Sites:\n${sites.map((s) => `  ${s.code}  ${s.name} (${s.city})`).join("\n")}`);
  return hit;
}

async function pickSuperadmin(prisma: PrismaClient, wanted: string | undefined): Promise<User> {
  if (wanted) {
    const u = await prisma.user.findFirst({ where: { username: wanted.toLowerCase(), active: true } });
    if (!u) fail(`No active user "${wanted}"`);
    if (u.role !== "SUPERADMIN") fail(`"${wanted}" is not a superadmin; the import must be entered by one`);
    return u;
  }
  const admins = await prisma.user.findMany({ where: { role: "SUPERADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (admins.length === 1) return admins[0];
  if (admins.length === 0) fail("No active superadmin found");
  fail(`Several superadmins; say who is entering this with --as:\n${admins.map((a) => `  ${a.username}  ${a.name}`).join("\n")}`);
}

async function pickHolder(prisma: PrismaClient, sheet: ExpenseSheet, site: Site, args: Args): Promise<User | null> {
  if (args.holder) {
    const u = await prisma.user.findFirst({ where: { username: args.holder.toLowerCase(), active: true } });
    if (!u) fail(`No active user with username "${args.holder}"`);
    return u;
  }
  const wanted = normalizePartyName(sheet.holder);
  const users = await prisma.user.findMany({ where: { active: true } });
  const byName = users.filter((u) => normalizePartyName(u.name) === wanted);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) fail(`Several users are named "${sheet.holder}"; pick one with --holder <username>:\n${byName.map((u) => `  ${u.username}`).join("\n")}`);
  if (!args.createHolder) {
    fail(
      `No user named "${sheet.holder}" in the app. Either pass --holder <username> of the existing account,\n` +
        `  or add them with: --create-holder --username <username> --password <password>\n` +
        `  Users on file: ${users.map((u) => `${u.username} (${u.name})`).join(", ") || "none"}`,
    );
  }
  const username = (args.username ?? "").trim().toLowerCase();
  const password = args.password ?? "";
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) fail("--username: 3 to 30 characters, letters, digits, dot, dash or underscore");
  if (password.length < 6) fail("--password: at least 6 characters");
  if (users.some((u) => u.username === username)) fail(`Username "${username}" is already taken`);
  if (args.dryRun) {
    console.log(`  would create supervisor ${sheet.holder} (${username}) on ${site.name}`);
    return null;
  }
  const created = await prisma.user.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10), name: sheet.holder.trim(), role: "SUPERVISOR", siteId: site.id },
  });
  console.log(`  created supervisor ${created.name} (${created.username}) on ${site.name}`);
  return created;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Deploy-time import of the bundled sheets. Never throws: a deploy must not fail
// because a sheet could not be entered; the superadmin can still do it from the
// phone, and the reason is printed in the build log.
// ---------------------------------------------------------------------------

/** vinod.shukla, vinod.shukla2, ... from a display name. */
function usernameFor(name: string, taken: Set<string>) {
  const base = normalizePartyName(name).replace(/[^a-z0-9 ]/g, "").replace(/ /g, ".").slice(0, 26) || "user";
  let u = base, n = 2;
  while (taken.has(u)) u = `${base}${n++}`;
  return u;
}

async function runBundled(prisma: PrismaClient) {
  console.log(`\n[sheets] ${BUNDLED_SHEETS.length} bundled expense sheet(s)`);
  if ((await prisma.user.count()) === 0) {
    console.log("[sheets] the app has not been set up yet (no users); skipping. Sheets can be entered from More → Admin after setup.");
    return;
  }
  const sites = await prisma.site.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  const admins = await prisma.user.findMany({ where: { role: "SUPERADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (sites.length === 0 || admins.length === 0) {
    console.log("[sheets] no active site or superadmin yet; skipping.");
    return;
  }
  const site = sites[0];
  const admin = admins[0];
  if (sites.length > 1) console.log(`[sheets] several sites exist; bundled sheets go to the first one, ${site.name}. Use the phone screen for another site.`);

  for (const sheet of BUNDLED_SHEETS) {
    try {
      const before = await sheetStatus(prisma, site.id, sheet);
      if (before.cashEntered >= before.cashTotal && before.linesEntered >= before.linesTotal) {
        console.log(`[sheets] ${sheet.id}: already entered (${before.linesPending} pending, ${before.linesApproved} approved)`);
        continue;
      }
      let holder: User | null = null;
      if (before.holder) {
        holder = await prisma.user.findFirst({ where: { id: before.holder.id } });
      } else {
        const users = await prisma.user.findMany({ where: { active: true } });
        const wanted = normalizePartyName(sheet.holder);
        const byName = users.filter((u) => normalizePartyName(u.name) === wanted);
        if (byName.length > 1) {
          console.log(`[sheets] ${sheet.id}: several logins are named "${sheet.holder}"; choose one on the phone (More → Admin → Import expense sheet).`);
          continue;
        }
        holder = byName[0] ?? null;
        if (!holder) {
          // No login for this person yet: create a supervisor on the site. The password is random and
          // unknown; the superadmin sets a real one under Users & passwords before handing the phone over.
          const taken = new Set((await prisma.user.findMany({ select: { username: true } })).map((u) => u.username));
          const username = usernameFor(sheet.holder, taken);
          holder = await prisma.user.create({
            data: { username, passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10), name: sheet.holder.trim(), role: "SUPERVISOR", siteId: site.id },
          });
          await prisma.auditLog.create({
            data: { userId: admin.id, siteId: site.id, action: "CREATE", entity: "User", entityId: holder.id, newValues: { username, name: holder.name, role: "SUPERVISOR", reason: `created for expense sheet ${sheet.id}` } },
          });
          console.log(`[sheets] ${sheet.id}: created supervisor login "${username}" for ${holder.name}. Set their password under Users & passwords.`);
        }
      }
      if (!holder) continue;
      const r = await importExpenseSheet(prisma, sheet, { siteId: site.id, holderId: holder.id, enteredById: admin.id });
      const b = r.balance!;
      console.log(
        `[sheets] ${sheet.id}: entered ${r.entered.cash} cash rows and ${r.entered.lines} lines for ${holder.name} (pending). ` +
          `Cash in hand ${inr(b.inHand)}, awaiting approval ${inr(b.awaitingApproval)}.`,
      );
    } catch (e) {
      console.log(`[sheets] ${sheet.id}: not entered — ${e instanceof Error ? e.message : String(e)}. Use More → Admin → Import expense sheet.`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    if (args.bundled) {
      console.log("[sheets] DATABASE_URL is not set; skipping the bundled sheets.");
      return;
    }
    fail("DATABASE_URL is not set. Put it in .env or export it before running.");
  }
  if (args.bundled) {
    const prisma = new PrismaClient();
    try {
      await runBundled(prisma);
    } catch (e) {
      console.log(`[sheets] skipped — ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      await prisma.$disconnect();
    }
    return;
  }
  const sheet = readSheet(args.file);
  const prisma = new PrismaClient();

  try {
    const site = await pickSite(prisma, args.site);
    const admin = await pickSuperadmin(prisma, args.as);
    console.log(`\n${sheet.title}`);
    console.log(`  site: ${site.name} (${site.code}) · entered by: ${admin.name}${args.dryRun ? " · DRY RUN, nothing is written" : ""}`);
    const holder = await pickHolder(prisma, sheet, site, args);
    if (!holder) {
      console.log("\nDry run: the holder does not exist yet, so nothing more can be previewed.");
      return;
    }
    console.log(`  cash holder: ${holder.name} (${holder.username})`);

    const report = await importExpenseSheet(prisma, sheet, { siteId: site.id, holderId: holder.id, enteredById: admin.id, approve: args.approve, dryRun: args.dryRun });

    console.log("\nCash received");
    for (const c of report.cash) {
      console.log(`  ${formatDate(c.date)}  ${c.kind.padEnd(7)}  ${inr(c.amount).padStart(12)}  ${c.memo ?? ""}${c.outcome === "exists" ? "  (already in ledger)" : ""}`);
    }
    console.log("\nExpense lines");
    for (const l of report.lines) {
      const tag = l.outcome === "exists" ? `(already entered, ${l.existingStatus?.toLowerCase()})` : l.approvedNow ? "(approved)" : "";
      console.log(`  ${formatDate(l.date)}  ${l.category.padEnd(28)}  ${inr(l.amount).padStart(12)}  ${l.description}${l.payee ? ` → ${l.payee}` : ""}  ${tag}`);
    }

    console.log("\nSheet totals");
    console.log(`  received ${inr(report.totals.received)}   spent ${inr(report.totals.spent)}   cash in hand ${inr(report.totals.inHand)}`);
    for (const w of report.warnings) console.log(`  ⚠ ${w}`);
    const misc = report.lines.filter((l) => l.filedAsMisc);
    if (misc.length) {
      console.log("\nFiled under Miscellaneous (add the worker to the labour master, then re-categorise in the app if wanted):");
      for (const l of misc) console.log(`  line ${l.n}: "${l.payee ?? l.description}" is not on the labour master`);
    }

    if (report.dryRun) {
      console.log("\nDry run: nothing written.");
      return;
    }
    const b = report.balance!;
    console.log(`\nWritten: ${report.entered.cash} cash rows, ${report.entered.lines} expense lines${args.approve ? `, ${report.entered.approved} approved now` : ""}.`);
    console.log(`${holder.name} in the app: advanced ${inr(b.advanced)}, approved spend ${inr(b.spent)}, cash in hand ${inr(b.inHand)}, awaiting approval ${inr(b.awaitingApproval)}.`);
    if (!args.approve && report.entered.lines > 0) console.log("Lines are PENDING: approve them on the dashboard, or re-run with --approve to approve them all now.");
  } catch (e) {
    if (e instanceof SheetError) fail(e.message);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
