import "server-only";
import { prisma } from "./prisma";

/** Wallet balance = top-ups + adjustments − expenses (voided excluded). */
export async function pettyBalance(siteId: string): Promise<number> {
  const groups = await prisma.pettyCashTxn.groupBy({ by: ["type"], where: { siteId, voidedAt: null }, _sum: { amount: true } });
  let bal = 0;
  for (const g of groups) {
    const amt = Number(g._sum.amount ?? 0);
    bal += g.type === "EXPENSE" ? -amt : amt;
  }
  return bal;
}

/** Average daily expense over the last 30 days. */
export async function pettyBurnRate(siteId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 86400000);
  const sum = await prisma.pettyCashTxn.aggregate({ where: { siteId, type: "EXPENSE", voidedAt: null, createdAt: { gte: since } }, _sum: { amount: true } });
  return Number(sum._sum.amount ?? 0) / 30;
}
