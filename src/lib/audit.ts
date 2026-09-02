import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "VOID"
  | "APPROVE"
  | "REJECT"
  | "LOGIN"
  | "LOGOUT"
  | "PASSWORD_RESET"
  | "PASSWORD_CHANGE"
  | "UNLOCK"
  | "SUBMIT";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function audit(
  params: {
    userId: string;
    siteId?: string | null;
    action: AuditAction;
    entity: string;
    entityId?: string | null;
    oldValues?: unknown;
    newValues?: unknown;
    ip?: string | null;
  },
  tx: Tx = prisma,
) {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      siteId: params.siteId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      oldValues: params.oldValues === undefined ? undefined : toJson(params.oldValues),
      newValues: params.newValues === undefined ? undefined : toJson(params.newValues),
      ip: params.ip ?? null,
    },
  });
}

/** Strip secrets and make Decimals/Dates JSON-safe. */
function toJson(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(v, (key, value) => {
      if (key === "passwordHash" || key === "password") return undefined;
      if (value && typeof value === "object" && typeof (value as { toFixed?: unknown }).toFixed === "function" && !(value instanceof Date)) {
        return value.toString();
      }
      return value;
    }) ?? "null",
  );
}
