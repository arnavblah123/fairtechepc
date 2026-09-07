import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api";

type Tx = Prisma.TransactionClient;

/** Adjust site stock; rejects if consuming more than on hand. */
export async function adjustStock(tx: Tx, siteId: string, itemId: string, delta: number, allowNegative = false) {
  const stock = await tx.consumableStock.upsert({
    where: { siteId_itemId: { siteId, itemId } },
    update: {},
    create: { siteId, itemId, qtyOnHand: 0 },
  });
  const next = Number(stock.qtyOnHand) + delta;
  if (next < 0 && !allowNegative) {
    throw new ApiError(400, `Only ${Number(stock.qtyOnHand)} in stock / स्टॉक में सिर्फ़ ${Number(stock.qtyOnHand)} है`);
  }
  await tx.consumableStock.update({ where: { id: stock.id }, data: { qtyOnHand: next } });
  return next;
}

/** kg of welding consumables used per MT fabricated, per job (the theft/wastage detector). */
export async function weldingNormForJob(jobId: string) {
  const [job, consumptions, progress] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId }, select: { weldingNormKgPerMT: true } }),
    prisma.consumableConsumption.findMany({ where: { jobId, voidedAt: null, item: { isWeldingConsumable: true } }, include: { item: { select: { kgPerUnit: true } } } }),
    prisma.stageProgress.findMany({ where: { jobId, voidedAt: null, stage: { unit: "MT" } }, include: { stage: { select: { sequence: true } } } }),
  ]);
  const kgUsed = consumptions.reduce((a, c) => a + Number(c.qty) * Number(c.item.kgPerUnit ?? 1), 0);
  // Fabricated MT = quantity through the furthest MT-based stage with progress (welding-type work).
  const bySeq = new Map<number, number>();
  for (const p of progress) bySeq.set(p.stage.sequence, (bySeq.get(p.stage.sequence) ?? 0) + Number(p.qtyDone));
  const mtDone = bySeq.size ? Math.max(...bySeq.values()) : 0;
  const actual = mtDone > 0 ? kgUsed / mtDone : null;
  const norm = job?.weldingNormKgPerMT ? Number(job.weldingNormKgPerMT) : null;
  return { kgUsed, mtDone, actualKgPerMT: actual, normKgPerMT: norm, over: actual !== null && norm !== null && actual > norm };
}
