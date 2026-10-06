/* eslint-disable no-console */
/**
 * Import a hand-kept expense sheet (the Excel a supervisor sends after a trip)
 * into the app, the same way the app itself would have recorded it:
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
 * Needs DATABASE_URL (read from .env when present).
 */
import { PrismaClient, type ExpenseCategory, type LedgerKind, type Prisma, type Site, type User, type Worker } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toPaise, toRupees } from "../src/lib/money";
import { dateKeyToDate, formatDate } from "../src/lib/format";
import { normalizePartyName } from "../src/lib/parties";

try {
  process.loadEnvFile?.(".env");
} catch {}

// ---------------------------------------------------------------------------
// Sheet format
// ---------------------------------------------------------------------------

type CashRow = { date: string; kind: "ADVANCE" | "TOPUP"; amount: number; memo?: string };
type LineRow = { date: string; category: string; description: string; amount: number; payee?: string };
type Sheet = {
  id: string;
  title: string;
  holder: string;
  cash: CashRow[];
  lines: LineRow[];
  expected?: { received?: number; spent?: number; inHand?: number };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readSheet(path: string): Sheet {
  const sheet = JSON.parse(readFileSync(resolve(path), "utf8")) as Sheet;
  if (!sheet.id || !/^[a-z0-9-]+$/.test(sheet.id)) fail(`Sheet needs an "id" of letters, digits and dashes (got ${JSON.stringify(sheet.id)})`);
  if (!Array.isArray(sheet.cash) || !Array.isArray(sheet.lines) || sheet.lines.length === 0) fail("Sheet needs a cash[] and a non-empty lines[]");
  sheet.cash.forEach((c, i) => {
    if (!DATE_RE.test(c.date)) fail(`cash[${i}]: date must be YYYY-MM-DD`);
    if (c.kind !== "ADVANCE" && c.kind !== "TOPUP") fail(`cash[${i}]: kind must be ADVANCE or TOPUP`);
    if (!(c.amount > 0)) fail(`cash[${i}]: amount must be more than 0`);
  });
  sheet.lines.forEach((l, i) => {
    if (!DATE_RE.test(l.date)) fail(`lines[${i}]: date must be YYYY-MM-DD`);
    if (!(l.amount > 0)) fail(`lines[${i}]: amount must be more than 0`);
    if (!l.category) fail(`lines[${i}]: category slug missing`);
    if (!l.description || l.description.trim().length < 3) fail(`lines[${i}]: description too short`);
  });
  return sheet;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

type Args = { file: string; site?: string; holder?: string; as?: string; approve: boolean; dryRun: boolean; createHolder: boolean; username?: string; password?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { file: "", approve: false, dryRun: false, createHolder: false };
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
    else if (a.startsWith("--")) fail(`Unknown option ${a}`);
    else if (!args.file) args.file = a;
    else fail(`Unexpected argument ${a}`);
  }
  if (!args.file) fail("Usage: tsx scripts/import-expense-sheet.ts <sheet.json> --site <code|name> --holder <username> [--as <superadmin>] [--approve] [--dry-run]");
  return args;
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// Ledger helpers (mirror src/lib/ledger.ts, which is server-only and cannot be
// imported from a script)
// ---------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;

function postingKey(sourceType: string, sourceId: string, kind: LedgerKind, suffix = "") {
  return `${sourceType}:${sourceId}:${kind}${suffix ? ":" + suffix : ""}`;
}

async function postLedger(tx: Tx, p: { siteId: string; holderId: string; kind: LedgerKind; magnitude: number; sourceType: string; sourceId: string; expenseId?: string | null; memo: string | null; createdById: string; keySuffix?: string }) {
  const key = postingKey(p.sourceType, p.sourceId, p.kind, p.keySuffix);
  if (await tx.cashLedger.findUnique({ where: { postingKey: key } })) return null;
  const credit = p.kind === "ADVANCE" || p.kind === "TOPUP";
  return tx.cashLedger.create({
    data: {
      siteId: p.siteId,
      holderId: p.holderId,
      kind: p.kind,
      amount: credit ? p.magnitude : -p.magnitude,
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      postingKey: key,
      expenseId: p.expenseId ?? null,
      memo: p.memo,
      createdById: p.createdById,
    },
  });
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

async function pickHolder(prisma: PrismaClient, sheet: Sheet, site: Site, args: Args, dryRun: boolean): Promise<User> {
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
  if (dryRun) {
    console.log(`  would create supervisor ${sheet.holder} (${username}) on ${site.name}`);
    return { id: "dry-run", username, name: sheet.holder, role: "SUPERVISOR", siteId: site.id } as User;
  }
  const created = await prisma.user.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10), name: sheet.holder.trim(), role: "SUPERVISOR", siteId: site.id },
  });
  console.log(`  created supervisor ${created.name} (${created.username}) on ${site.name}`);
  return created;
}

/** The worker a payee name refers to, when the site has exactly one such name. */
function matchWorker(workers: Worker[], payee: string): Worker | undefined {
  const wanted = normalizePartyName(payee);
  const exact = workers.filter((w) => normalizePartyName(w.name) === wanted);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const loose = workers.filter((w) => normalizePartyName(w.name).startsWith(wanted + " "));
  return loose.length === 1 ? loose[0] : undefined;
}

async function partyFor(tx: Tx, siteId: string, name: string, kind: "LABOUR" | "VENDOR") {
  const typed = name.trim();
  const normalizedName = normalizePartyName(name);
  const existing = await tx.party.findUnique({ where: { siteId_normalizedName: { siteId, normalizedName } } });
  if (existing) return existing;
  return tx.party.create({ data: { siteId, name: typed, normalizedName, kind } });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set. Put it in .env or export it before running.");
  const sheet = readSheet(args.file);
  const prisma = new PrismaClient();

  try {
    const site = await pickSite(prisma, args.site);
    const admin = await pickSuperadmin(prisma, args.as);
    console.log(`\n${sheet.title}`);
    console.log(`  site: ${site.name} (${site.code}) · entered by: ${admin.name}${args.dryRun ? " · DRY RUN, nothing is written" : ""}`);
    const holder = await pickHolder(prisma, sheet, site, args, args.dryRun);
    console.log(`  cash holder: ${holder.name} (${holder.username})`);

    const categories = await prisma.expenseCategory.findMany({ where: { active: true } });
    const bySlug = new Map<string, ExpenseCategory>(categories.map((c) => [c.slug, c]));
    const misc = bySlug.get("miscellaneous");
    if (!misc) fail('The "miscellaneous" expense category is missing. Run `npm run db:seed` first.');
    for (const l of sheet.lines) if (!bySlug.has(l.category)) fail(`Unknown category slug "${l.category}". Known: ${[...bySlug.keys()].join(", ")}`);
    const workers = await prisma.worker.findMany({ where: { siteId: site.id, active: true } });

    // ---- Cash received -----------------------------------------------------
    console.log("\nCash received");
    let cashNew = 0;
    for (const [i, c] of sheet.cash.entries()) {
      const sourceId = `${sheet.id}/cash/${i + 1}`;
      const key = postingKey("import", sourceId, c.kind);
      const exists = await prisma.cashLedger.findUnique({ where: { postingKey: key } });
      const memo = c.memo?.trim() || null;
      console.log(`  ${formatDate(c.date)}  ${c.kind.padEnd(7)}  ${inr(c.amount).padStart(12)}  ${memo ?? ""}${exists ? "  (already in ledger)" : ""}`);
      if (exists || args.dryRun) continue;
      await prisma.$transaction(async (tx) => {
        await postLedger(tx, { siteId: site.id, holderId: holder.id, kind: c.kind, magnitude: c.amount, sourceType: "import", sourceId, memo, createdById: admin.id });
        await tx.pettyCashTxn.create({
          data: {
            siteId: site.id,
            date: dateKeyToDate(c.date),
            type: "TOPUP",
            amount: c.amount,
            description: `Cash given to ${holder.name}${memo ? ` — ${memo}` : ""}`,
            paidTo: holder.name,
            enteredById: admin.id,
          },
        });
        await tx.auditLog.create({
          data: { userId: admin.id, siteId: site.id, action: "CREATE", entity: "CashLedger", entityId: sourceId, newValues: { holder: holder.name, kind: c.kind, amount: c.amount, memo, sheet: sheet.id } },
        });
      });
      cashNew++;
    }

    // ---- Expense lines -------------------------------------------------------
    console.log("\nExpense lines");
    let linesNew = 0, approvedNow = 0;
    const fallbacks: string[] = [];
    for (const [i, l] of sheet.lines.entries()) {
      const marker = `Imported from expense sheet ${sheet.id}, line ${i + 1}`;
      let category = bySlug.get(l.category)!;
      const paidToPerson = category.requiresPerson; // the sheet says this went to a labourer, matched or not
      let worker: Worker | undefined;
      if (category.requiresPerson) {
        worker = l.payee ? matchWorker(workers, l.payee) : undefined;
        if (!worker) {
          // No such name on the labour master: keep the payee on the line but file it as miscellaneous.
          fallbacks.push(`line ${i + 1}: "${l.payee ?? l.description}" is not on the labour master, filed under ${misc.name}`);
          category = misc;
        }
      }
      if (category.requiresMachine) fail(`line ${i + 1}: ${category.name} needs a machine; enter this one in the app instead`);

      const existing = await prisma.expense.findFirst({ where: { siteId: site.id, note: { contains: marker }, voidedAt: null } });
      const tag = existing ? `(already entered, ${existing.status.toLowerCase()})` : "";
      console.log(`  ${formatDate(l.date)}  ${category.name.padEnd(28)}  ${inr(l.amount).padStart(12)}  ${l.description}${l.payee ? ` → ${l.payee}` : ""}  ${tag}`);

      let expenseId = existing?.id;
      if (!existing && !args.dryRun) {
        const created = await prisma.$transaction(async (tx) => {
          const party = l.payee ? await partyFor(tx, site.id, l.payee, paidToPerson ? "LABOUR" : "VENDOR") : null;
          const e = await tx.expense.create({
            data: {
              siteId: site.id,
              date: dateKeyToDate(l.date),
              amount: l.amount,
              categoryId: category.id,
              entryType: "PAYMENT", // no bill photo on a hand-kept sheet, same rule as a bill entered without one
              paidFrom: "WORKER_CASH",
              description: l.description.trim(),
              note: marker,
              partyId: party?.id ?? null,
              payeeText: l.payee?.trim() || null,
              workerId: worker?.id ?? null,
              spentById: holder.id,
              enteredById: admin.id,
            },
          });
          await tx.auditLog.create({
            data: { userId: admin.id, siteId: site.id, action: "CREATE", entity: "Expense", entityId: e.id, newValues: { amount: l.amount, category: category.name, description: l.description, payee: l.payee ?? null, spentBy: holder.name, sheet: sheet.id } },
          });
          return e;
        });
        expenseId = created.id;
        linesNew++;
      }

      // ---- Approval: same steps as decideExpense() in src/lib/expenses.ts ----
      if (args.approve && expenseId && !args.dryRun) {
        const e = await prisma.expense.findUnique({ where: { id: expenseId }, include: { category: true } });
        if (!e || e.status === "APPROVED") continue;
        await prisma.$transaction(async (tx) => {
          await tx.expense.update({ where: { id: e.id }, data: { status: "APPROVED", decidedById: admin.id, decidedAt: new Date(), decisionNote: null } });
          const attempts = await tx.cashLedger.count({ where: { expenseId: e.id, sourceType: "expense" } });
          await postLedger(tx, {
            siteId: e.siteId,
            holderId: e.spentById,
            kind: "EXPENSE",
            magnitude: Number(e.amount),
            sourceType: "expense",
            sourceId: e.id,
            expenseId: e.id,
            memo: `${e.category.name}: ${e.description}`,
            createdById: admin.id,
            keySuffix: attempts > 0 ? String(attempts) : "",
          });
          const txn = await tx.pettyCashTxn.findUnique({ where: { expenseId: e.id } });
          if (txn) {
            if (txn.voidedAt) await tx.pettyCashTxn.update({ where: { id: txn.id }, data: { voidedAt: null, voidReason: null, amount: e.amount } });
          } else {
            await tx.pettyCashTxn.create({
              data: { siteId: e.siteId, date: e.date, type: "EXPENSE", amount: e.amount, description: `${e.category.name}: ${e.description}`, paidTo: e.payeeText, expenseId: e.id, enteredById: admin.id },
            });
          }
          await tx.auditLog.create({ data: { userId: admin.id, siteId: e.siteId, action: "APPROVE", entity: "Expense", entityId: e.id, newValues: { status: "APPROVED", sheet: sheet.id } } });
        });
        approvedNow++;
      }
    }

    // ---- Summary -------------------------------------------------------------
    const received = toRupees(sheet.cash.reduce((a, c) => a + toPaise(c.amount), 0));
    const spent = toRupees(sheet.lines.reduce((a, l) => a + toPaise(l.amount), 0));
    console.log("\nSheet totals");
    console.log(`  received ${inr(received)}   spent ${inr(spent)}   cash in hand ${inr(toRupees(toPaise(received) - toPaise(spent)))}`);
    for (const [k, v] of Object.entries(sheet.expected ?? {})) {
      const actual = k === "received" ? received : k === "spent" ? spent : toRupees(toPaise(received) - toPaise(spent));
      if (v !== undefined && toPaise(v) !== toPaise(actual)) console.log(`  ⚠ sheet says ${k} = ${inr(v)} but the lines add up to ${inr(actual)}`);
    }
    if (fallbacks.length) {
      console.log("\nFiled under Miscellaneous (add the worker to the labour master, then re-categorise in the app if wanted):");
      for (const f of fallbacks) console.log(`  ${f}`);
    }

    if (args.dryRun) {
      console.log("\nDry run: nothing written.");
      return;
    }
    const rows = await prisma.cashLedger.findMany({ where: { holderId: holder.id }, select: { kind: true, amount: true } });
    let adv = 0, exp = 0, ret = 0, adj = 0;
    for (const r of rows) {
      const p = toPaise(r.amount);
      if (r.kind === "ADVANCE" || r.kind === "TOPUP") adv += p;
      else if (r.kind === "EXPENSE") exp += p;
      else if (r.kind === "RETURN") ret += p;
      else adj += p;
    }
    const pending = await prisma.expense.aggregate({ where: { spentById: holder.id, status: { in: ["PENDING", "QUERIED"] }, paidFrom: "WORKER_CASH", voidedAt: null }, _sum: { amount: true } });
    console.log(`\nWritten: ${cashNew} cash rows, ${linesNew} expense lines${args.approve ? `, ${approvedNow} approved now` : ""}.`);
    console.log(`${holder.name} in the app: advanced ${inr(toRupees(adv))}, approved spend ${inr(toRupees(Math.abs(exp)))}, cash in hand ${inr(toRupees(adv + exp + ret + adj))}, awaiting approval ${inr(Number(pending._sum.amount ?? 0))}.`);
    if (!args.approve && linesNew > 0) console.log("Lines are PENDING: approve them on the dashboard, or re-run with --approve to approve them all now.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
