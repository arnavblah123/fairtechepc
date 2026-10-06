// Shared by scripts/import-expense-sheet.ts (CLI) and /api/import/expense-sheet
// (the "Import expense sheet" screen under More → Admin). No Next.js imports
// here, and nothing from ./ledger or ./expenses, which are server-only.
import type { ExpenseCategory, LedgerKind, Prisma, PrismaClient, Worker } from "@prisma/client";
import { toPaise, toRupees } from "./money";
import { dateKeyToDate } from "./format";
import { normalizePartyName } from "./parties";
import vinodShuklaPuneRajasthan202610 from "../../data/expense-sheets/vinod-shukla-pune-rajasthan-2026-10.json";

// ---------------------------------------------------------------------------
// Sheet format (data/expense-sheets/*.json)
// ---------------------------------------------------------------------------

export type SheetCash = { date: string; kind: "ADVANCE" | "TOPUP"; amount: number; memo?: string };
export type SheetLine = { date: string; category: string; description: string; amount: number; payee?: string };
export type ExpenseSheet = {
  /** Letters, digits and dashes. Part of every posting key, so never change it once entered. */
  id: string;
  title: string;
  /** The person whose cash this is, as written on the sheet. */
  holder: string;
  cash: SheetCash[];
  lines: SheetLine[];
  expected?: { received?: number; spent?: number; inHand?: number };
};

export class SheetError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Checks a parsed JSON file is a usable sheet. Throws SheetError with a plain message. */
export function validateSheet(raw: unknown): ExpenseSheet {
  const s = raw as Partial<ExpenseSheet>;
  if (!s || typeof s !== "object") throw new SheetError("Sheet must be a JSON object");
  if (!s.id || !/^[a-z0-9-]+$/.test(s.id)) throw new SheetError(`Sheet needs an "id" of letters, digits and dashes (got ${JSON.stringify(s.id)})`);
  if (!s.title || !s.holder) throw new SheetError(`Sheet ${s.id} needs a "title" and a "holder"`);
  if (!Array.isArray(s.cash) || !Array.isArray(s.lines) || s.lines.length === 0) throw new SheetError(`Sheet ${s.id} needs a cash[] and a non-empty lines[]`);
  s.cash.forEach((c, i) => {
    if (!DATE_RE.test(c.date)) throw new SheetError(`cash[${i}]: date must be YYYY-MM-DD`);
    if (c.kind !== "ADVANCE" && c.kind !== "TOPUP") throw new SheetError(`cash[${i}]: kind must be ADVANCE or TOPUP`);
    if (!(c.amount > 0)) throw new SheetError(`cash[${i}]: amount must be more than 0`);
  });
  s.lines.forEach((l, i) => {
    if (!DATE_RE.test(l.date)) throw new SheetError(`lines[${i}]: date must be YYYY-MM-DD`);
    if (!(l.amount > 0)) throw new SheetError(`lines[${i}]: amount must be more than 0`);
    if (!l.category) throw new SheetError(`lines[${i}]: category slug missing`);
    if (!l.description || l.description.trim().length < 3) throw new SheetError(`lines[${i}]: description too short`);
  });
  return s as ExpenseSheet;
}

/**
 * Sheets shipped with the app, so the superadmin can enter them from the phone
 * without a database connection string. Add a new sheet's JSON to
 * data/expense-sheets/ and import it here.
 */
export const BUNDLED_SHEETS: ExpenseSheet[] = [vinodShuklaPuneRajasthan202610].map(validateSheet);

export function sheetTotals(sheet: ExpenseSheet) {
  const received = sheet.cash.reduce((a, c) => a + toPaise(c.amount), 0);
  const spent = sheet.lines.reduce((a, l) => a + toPaise(l.amount), 0);
  return { received: toRupees(received), spent: toRupees(spent), inHand: toRupees(received - spent) };
}

/** Where the sheet's totals disagree with its own lines. Empty when the sheet adds up. */
export function sheetWarnings(sheet: ExpenseSheet): string[] {
  const totals = sheetTotals(sheet);
  const out: string[] = [];
  for (const k of ["received", "spent", "inHand"] as const) {
    const v = sheet.expected?.[k];
    if (v !== undefined && toPaise(v) !== toPaise(totals[k])) out.push(`The sheet says ${k} = ${v} but its lines add up to ${totals[k]}.`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Idempotency keys. Shared with the CLI so a sheet half-entered from a laptop
// and finished from the phone still comes out once.
// ---------------------------------------------------------------------------

export function cashSourceId(sheetId: string, n: number) {
  return `${sheetId}/cash/${n}`;
}
export function lineMarker(sheetId: string, n: number) {
  return `Imported from expense sheet ${sheetId}, line ${n}`;
}
/** Prefix every line marker of one sheet starts with. */
export function sheetMarkerPrefix(sheetId: string) {
  return `Imported from expense sheet ${sheetId}, line `;
}

function postingKey(sourceType: string, sourceId: string, kind: LedgerKind, suffix = "") {
  return `${sourceType}:${sourceId}:${kind}${suffix ? ":" + suffix : ""}`;
}

type Db = PrismaClient | Prisma.TransactionClient;
type Tx = Prisma.TransactionClient;

/** Mirrors post() in src/lib/ledger.ts, which is server-only and cannot be used from a script. */
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

/** The worker a payee name refers to, when the site has exactly one such name. */
export function matchWorker(workers: Pick<Worker, "id" | "name">[], payee: string) {
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
// Where a sheet stands in the database
// ---------------------------------------------------------------------------

export type SheetStatus = {
  sheetId: string;
  cashEntered: number;
  cashTotal: number;
  linesEntered: number;
  linesTotal: number;
  /** Lines entered and still waiting for approval (pending or queried). */
  linesPending: number;
  linesApproved: number;
  /** Who the entered rows were charged to, when any are in. */
  holder: { id: string; name: string } | null;
};

export async function sheetStatus(db: Db, siteId: string, sheet: ExpenseSheet): Promise<SheetStatus> {
  const [cashRows, expenses] = await Promise.all([
    db.cashLedger.findMany({ where: { siteId, sourceType: "import", sourceId: { startsWith: `${sheet.id}/cash/` } }, select: { holder: { select: { id: true, name: true } } } }),
    db.expense.findMany({ where: { siteId, note: { startsWith: sheetMarkerPrefix(sheet.id) } }, select: { status: true, voidedAt: true, spentBy: { select: { id: true, name: true } } } }),
  ]);
  const live = expenses.filter((e) => !e.voidedAt);
  return {
    sheetId: sheet.id,
    cashEntered: cashRows.length,
    cashTotal: sheet.cash.length,
    linesEntered: expenses.length,
    linesTotal: sheet.lines.length,
    linesPending: live.filter((e) => e.status === "PENDING" || e.status === "QUERIED").length,
    linesApproved: live.filter((e) => e.status === "APPROVED").length,
    holder: cashRows[0]?.holder ?? live[0]?.spentBy ?? null,
  };
}

// ---------------------------------------------------------------------------
// The import itself
// ---------------------------------------------------------------------------

export type RowOutcome = "entered" | "exists" | "would-enter";

export type CashResult = { n: number; date: string; kind: "ADVANCE" | "TOPUP"; amount: number; memo: string | null; outcome: RowOutcome };
export type LineResult = {
  n: number;
  date: string;
  category: string;
  amount: number;
  description: string;
  payee: string | null;
  outcome: RowOutcome;
  /** Status of the expense already in the app, when outcome is "exists". */
  existingStatus?: string;
  /** The payee was not on the labour master, so the line went under Miscellaneous. */
  filedAsMisc?: boolean;
  approvedNow?: boolean;
};

export type ImportReport = {
  sheetId: string;
  title: string;
  dryRun: boolean;
  holder: { id: string; name: string };
  cash: CashResult[];
  lines: LineResult[];
  totals: { received: number; spent: number; inHand: number };
  warnings: string[];
  entered: { cash: number; lines: number; approved: number };
  /** The holder's ledger after the run (not computed on a dry run). */
  balance: { advanced: number; spent: number; inHand: number; awaitingApproval: number } | null;
};

export type ImportOptions = {
  siteId: string;
  /** Whose cash-in-hand ledger receives the cash and is charged for the lines. */
  holderId: string;
  /** The superadmin entering it. */
  enteredById: string;
  /** Approve every line on the spot (CLI only; the app leaves them pending). */
  approve?: boolean;
  /** Report what would happen without writing. */
  dryRun?: boolean;
};

/**
 * Enter a sheet the way the app itself would have: cash received as rows in the
 * holder's cash-in-hand ledger plus the site cash book; every line spent as an
 * expense charged to them, PENDING until approved on the dashboard.
 *
 * Safe to run twice: cash rows carry a fixed posting key and every expense a
 * sheet marker in its note, so a re-run only reports what is already there.
 */
export async function importExpenseSheet(db: PrismaClient, sheet: ExpenseSheet, opts: ImportOptions): Promise<ImportReport> {
  const dryRun = !!opts.dryRun;
  const [site, holder, admin] = await Promise.all([
    db.site.findFirst({ where: { id: opts.siteId, active: true } }),
    db.user.findFirst({ where: { id: opts.holderId, active: true } }),
    db.user.findFirst({ where: { id: opts.enteredById, active: true } }),
  ]);
  if (!site) throw new SheetError("Site not found");
  if (!holder) throw new SheetError("Person not found");
  if (!admin) throw new SheetError("Entering user not found");

  const categories = await db.expenseCategory.findMany({ where: { active: true } });
  const bySlug = new Map<string, ExpenseCategory>(categories.map((c) => [c.slug, c]));
  const misc = bySlug.get("miscellaneous");
  if (!misc) throw new SheetError('The "miscellaneous" expense category is missing. Run the seed first.');
  sheet.lines.forEach((l, i) => {
    const c = bySlug.get(l.category);
    if (!c) throw new SheetError(`Line ${i + 1}: unknown category "${l.category}". Known: ${[...bySlug.keys()].join(", ")}`);
    if (c.requiresMachine) throw new SheetError(`Line ${i + 1}: ${c.name} needs a machine; enter this one in the app instead`);
  });
  const workers = await db.worker.findMany({ where: { siteId: site.id, active: true }, select: { id: true, name: true } });

  const report: ImportReport = {
    sheetId: sheet.id,
    title: sheet.title,
    dryRun,
    holder: { id: holder.id, name: holder.name },
    cash: [],
    lines: [],
    totals: sheetTotals(sheet),
    warnings: sheetWarnings(sheet),
    entered: { cash: 0, lines: 0, approved: 0 },
    balance: null,
  };

  // ---- Cash received -------------------------------------------------------
  for (const [i, c] of sheet.cash.entries()) {
    const n = i + 1;
    const sourceId = cashSourceId(sheet.id, n);
    const memo = c.memo?.trim() || null;
    const exists = await db.cashLedger.findUnique({ where: { postingKey: postingKey("import", sourceId, c.kind) } });
    const row: CashResult = { n, date: c.date, kind: c.kind, amount: c.amount, memo, outcome: exists ? "exists" : dryRun ? "would-enter" : "entered" };
    report.cash.push(row);
    if (exists || dryRun) continue;
    await db.$transaction(async (tx) => {
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
    report.entered.cash++;
  }

  // ---- Expense lines -------------------------------------------------------
  for (const [i, l] of sheet.lines.entries()) {
    const n = i + 1;
    const marker = lineMarker(sheet.id, n);
    let category = bySlug.get(l.category)!;
    const paidToPerson = category.requiresPerson; // the sheet says this went to a labourer, matched or not
    let worker: { id: string; name: string } | undefined;
    let filedAsMisc = false;
    if (category.requiresPerson) {
      worker = l.payee ? matchWorker(workers, l.payee) : undefined;
      if (!worker) {
        // Not on the labour master: keep the payee on the line but file it as miscellaneous.
        filedAsMisc = true;
        category = misc;
      }
    }

    // Voided lines count as entered too: someone cancelled them on purpose.
    const existing = await db.expense.findFirst({ where: { siteId: site.id, note: marker } });
    const row: LineResult = {
      n,
      date: l.date,
      category: category.name,
      amount: l.amount,
      description: l.description.trim(),
      payee: l.payee?.trim() || null,
      outcome: existing ? "exists" : dryRun ? "would-enter" : "entered",
      existingStatus: existing ? (existing.voidedAt ? "VOIDED" : existing.status) : undefined,
      filedAsMisc: filedAsMisc || undefined,
    };
    report.lines.push(row);

    let expenseId = existing?.id;
    if (!existing && !dryRun) {
      const created = await db.$transaction(async (tx) => {
        const party = l.payee ? await partyFor(tx, site.id, l.payee, paidToPerson ? "LABOUR" : "VENDOR") : null;
        const e = await tx.expense.create({
          data: {
            siteId: site.id,
            date: dateKeyToDate(l.date),
            amount: l.amount,
            categoryId: category.id,
            entryType: "PAYMENT", // no bill photo on a hand-kept sheet, same rule as a bill entered without one
            paidFrom: "WORKER_CASH",
            description: row.description,
            note: marker,
            partyId: party?.id ?? null,
            payeeText: row.payee,
            workerId: worker?.id ?? null,
            spentById: holder.id,
            enteredById: admin.id,
          },
        });
        await tx.auditLog.create({
          data: { userId: admin.id, siteId: site.id, action: "CREATE", entity: "Expense", entityId: e.id, newValues: { amount: l.amount, category: category.name, description: row.description, payee: row.payee, spentBy: holder.name, sheet: sheet.id } },
        });
        return e;
      });
      expenseId = created.id;
      report.entered.lines++;
    }

    // ---- Approval: same steps as decideExpense() in src/lib/expenses.ts ----
    if (opts.approve && expenseId && !dryRun) {
      const e = await db.expense.findFirst({ where: { id: expenseId, voidedAt: null }, include: { category: true } });
      if (!e || e.status === "APPROVED") continue;
      await db.$transaction(async (tx) => {
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
      row.approvedNow = true;
      report.entered.approved++;
    }
  }

  if (!dryRun) {
    const rows = await db.cashLedger.findMany({ where: { holderId: holder.id }, select: { kind: true, amount: true } });
    let adv = 0, exp = 0, other = 0;
    for (const r of rows) {
      const p = toPaise(r.amount);
      if (r.kind === "ADVANCE" || r.kind === "TOPUP") adv += p;
      else if (r.kind === "EXPENSE") exp += p;
      else other += p;
    }
    const pending = await db.expense.aggregate({
      where: { spentById: holder.id, status: { in: ["PENDING", "QUERIED"] }, paidFrom: "WORKER_CASH", voidedAt: null },
      _sum: { amount: true },
    });
    report.balance = {
      advanced: toRupees(adv),
      spent: toRupees(-exp) || 0,
      inHand: toRupees(adv + exp + other),
      awaitingApproval: toRupees(toPaise(pending._sum.amount ?? 0)),
    };
  }
  return report;
}
