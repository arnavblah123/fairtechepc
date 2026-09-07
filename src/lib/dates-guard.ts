import "server-only";
import type { UnlockModule } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api";
import type { SessionUser } from "./auth";
import { istDateKey, istHour, addDays, dateKeyToDate } from "./format";

/**
 * Backdating rule (non-negotiable #2):
 * - today: always allowed
 * - yesterday: attendance all day; everything else until 10:00 IST
 * - older or future: superadmin only, or an active BackdateUnlock for that site+module+date
 */
export async function assertEditableDate(user: SessionUser, siteId: string, module: UnlockModule, dateKeyStr: string) {
  const today = istDateKey();
  if (dateKeyStr > today) throw new ApiError(400, "Cannot enter data for a future date");
  if (dateKeyStr === today) return;
  const yesterday = addDays(today, -1);
  if (dateKeyStr === yesterday) {
    if (module === "ATTENDANCE" || istHour() < 10) return;
  }
  if (user.role === "SUPERADMIN") return;
  const unlock = await prisma.backdateUnlock.findFirst({
    where: { siteId, module, date: dateKeyToDate(dateKeyStr), expiresAt: { gt: new Date() } },
  });
  if (!unlock) {
    throw new ApiError(403, "This date is locked. Ask Arnav to unlock it (More → Unlock past date). / यह तारीख़ बंद है, अरनव से अनलॉक कराएँ");
  }
}
