import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api";

/**
 * Every record type that can be deleted, in one place.
 *
 * Nothing is hard-deleted: rows are marked void with a reason and stay in the
 * database and in the audit log. Where a record changed a running total
 * (stock, petty cash), `after` reverses that effect so the numbers stay true.
 */
export type DeletableEntity =
  | "Job"
  | "Stage"
  | "StageProgress"
  | "JobMaterial"
  | "Worker"
  | "Attendance"
  | "Holiday"
  | "Advance"
  | "WageSheet"
  | "DailyPlan"
  | "DPR"
  | "SitePhoto"
  | "Issue"
  | "ConsumableDispatch"
  | "ConsumableConsumption"
  | "ConsumableRequest"
  | "ConsumableItem"
  | "PettyCashRequest"
  | "PettyCashTxn"
  | "Machine"
  | "MachineDispatch"
  | "MachineTicket"
  | "User"
  | "Site";

type Tx = Prisma.TransactionClient;

type Handler = {
  label: string;
  /** Block the delete when it would leave inconsistent history. */
  guard?: (tx: Tx, id: string) => Promise<void>;
  /** Mark it void / inactive. */
  remove: (tx: Tx, id: string, reason: string) => Promise<{ siteId?: string | null }>;
};

const softVoid =
  (model: keyof Tx & string) =>
  async (tx: Tx, id: string, reason: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (tx as any)[model].update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason } });
    return { siteId: row.siteId ?? null };
  };

export const DELETABLE: Record<DeletableEntity, Handler> = {
  Job: {
    label: "Job",
    remove: async (tx, id, reason) => {
      const job = await tx.job.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason, status: "CLOSED" } });
      // Stages of a cancelled job go with it, so they stop showing in pickers.
      await tx.stage.updateMany({ where: { jobId: id, voidedAt: null }, data: { voidedAt: new Date(), voidReason: `Job cancelled: ${reason}` } });
      return { siteId: job.siteId };
    },
  },
  Stage: {
    label: "Stage",
    guard: async (tx, id) => {
      const n = await tx.stageProgress.count({ where: { stageId: id, voidedAt: null } });
      if (n > 0) throw new ApiError(400, "This stage has progress entries. Delete those first, or cancel the whole job.");
    },
    remove: async (tx, id, reason) => {
      const target = await tx.stage.findUniqueOrThrow({ where: { id } });
      // Park the deleted stage below every live one so renumbering cannot collide
      // with it on the (jobId, sequence) unique index.
      const min = await tx.stage.aggregate({ where: { jobId: target.jobId }, _min: { sequence: true } });
      const stage = await tx.stage.update({
        where: { id },
        data: { voidedAt: new Date(), voidReason: reason, sequence: (min._min.sequence ?? 1) - 1 },
      });
      // Keep the remaining stages numbered 1..n, in two passes to stay unique throughout.
      const live = await tx.stage.findMany({ where: { jobId: stage.jobId, voidedAt: null }, orderBy: { sequence: "asc" } });
      for (let i = 0; i < live.length; i++) await tx.stage.update({ where: { id: live[i].id }, data: { sequence: 10000 + i } });
      for (let i = 0; i < live.length; i++) await tx.stage.update({ where: { id: live[i].id }, data: { sequence: i + 1 } });
      return { siteId: stage.siteId };
    },
  },
  StageProgress: {
    label: "Progress entry",
    remove: async (tx, id, reason) => {
      const row = await tx.stageProgress.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason } });
      await tx.stageWorkLog.deleteMany({ where: { stageProgressId: id } }); // frees those workers for that day
      return { siteId: row.siteId };
    },
  },
  JobMaterial: { label: "Planned material", remove: softVoid("jobMaterial") },
  Worker: {
    label: "Worker",
    remove: async (tx, id) => {
      const w = await tx.worker.update({ where: { id }, data: { active: false, leavingDate: new Date() } });
      return { siteId: w.siteId };
    },
  },
  Attendance: { label: "Attendance entry", remove: softVoid("attendance") },
  Holiday: {
    label: "Holiday",
    remove: async (tx, id) => {
      const h = await tx.holiday.delete({ where: { id } }); // calendar config, not a transaction record
      return { siteId: h.siteId };
    },
  },
  Advance: {
    label: "Advance",
    guard: async (tx, id) => {
      const a = await tx.advance.findUniqueOrThrow({ where: { id } });
      if (a.wageSheetId) throw new ApiError(400, "This advance is already deducted in a wage sheet. Delete that sheet first.");
    },
    remove: softVoid("advance"),
  },
  WageSheet: {
    label: "Wage sheet",
    remove: async (tx, id, reason) => {
      const s = await tx.wageSheet.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason } });
      await tx.advance.updateMany({ where: { wageSheetId: id }, data: { wageSheetId: null } }); // advances become pending deduction again
      return { siteId: s.siteId };
    },
  },
  DailyPlan: { label: "Daily plan", remove: softVoid("dailyPlan") },
  DPR: { label: "DPR", remove: softVoid("dPR") },
  SitePhoto: { label: "Photo", remove: softVoid("sitePhoto") },
  Issue: { label: "Issue", remove: softVoid("issue") },
  ConsumableDispatch: {
    label: "Stock dispatch",
    remove: async (tx, id, reason) => {
      const d = await tx.consumableDispatch.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason } });
      if (d.receivedAt && d.receivedQty) await addStock(tx, d.siteId, d.itemId, -Number(d.receivedQty)); // take the received stock back out
      return { siteId: d.siteId };
    },
  },
  ConsumableConsumption: {
    label: "Consumption entry",
    remove: async (tx, id, reason) => {
      const c = await tx.consumableConsumption.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason } });
      await addStock(tx, c.siteId, c.itemId, Number(c.qty)); // put the quantity back on the shelf
      return { siteId: c.siteId };
    },
  },
  ConsumableRequest: {
    label: "Material request",
    remove: async (tx, id, reason) => {
      const r = await tx.consumableRequest.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason } });
      const txn = await tx.pettyCashTxn.findUnique({ where: { consumableRequestId: id } });
      if (txn && !txn.voidedAt) await tx.pettyCashTxn.update({ where: { id: txn.id }, data: { voidedAt: new Date(), voidReason: `Request deleted: ${reason}` } });
      return { siteId: r.siteId };
    },
  },
  ConsumableItem: {
    label: "Item",
    remove: async (tx, id) => {
      await tx.consumableItem.update({ where: { id }, data: { active: false } });
      return { siteId: null };
    },
  },
  PettyCashRequest: { label: "Cash request", remove: softVoid("pettyCashRequest") },
  PettyCashTxn: { label: "Cash entry", remove: softVoid("pettyCashTxn") },
  Machine: {
    label: "Machine",
    remove: async (tx, id) => {
      const m = await tx.machine.update({ where: { id }, data: { active: false } });
      return { siteId: m.siteId };
    },
  },
  MachineDispatch: { label: "Machine dispatch", remove: softVoid("machineDispatch") },
  MachineTicket: { label: "Breakdown ticket", remove: softVoid("machineTicket") },
  User: {
    label: "User",
    guard: async (tx, id) => {
      const u = await tx.user.findUniqueOrThrow({ where: { id } });
      if (u.role === "SUPERADMIN") {
        const others = await tx.user.count({ where: { role: "SUPERADMIN", active: true, id: { not: id } } });
        if (others === 0) throw new ApiError(400, "At least one active superadmin must remain");
      }
    },
    remove: async (tx, id) => {
      const u = await tx.user.update({ where: { id }, data: { active: false } });
      await tx.session.deleteMany({ where: { userId: id } }); // log them out everywhere
      return { siteId: u.siteId };
    },
  },
  Site: {
    label: "Site",
    remove: async (tx, id) => {
      await tx.site.update({ where: { id }, data: { active: false } });
      return { siteId: id };
    },
  },
};

async function addStock(tx: Tx, siteId: string, itemId: string, delta: number) {
  const stock = await tx.consumableStock.upsert({ where: { siteId_itemId: { siteId, itemId } }, update: {}, create: { siteId, itemId, qtyOnHand: 0 } });
  await tx.consumableStock.update({ where: { id: stock.id }, data: { qtyOnHand: Math.max(0, Number(stock.qtyOnHand) + delta) } });
}

export async function deleteRecord(entity: DeletableEntity, id: string, reason: string) {
  const handler = DELETABLE[entity];
  if (!handler) throw new ApiError(400, "Unknown record type");
  return prisma.$transaction(async (tx) => {
    if (handler.guard) await handler.guard(tx, id);
    const { siteId } = await handler.remove(tx, id, reason);
    return { siteId: siteId ?? null, label: handler.label };
  });
}
