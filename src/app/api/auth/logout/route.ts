import { NextResponse } from "next/server";
import { destroySession, getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST() {
  const user = await getSessionUser();
  if (user) await audit({ userId: user.id, siteId: user.siteId, action: "LOGOUT", entity: "User", entityId: user.id });
  await destroySession();
  return NextResponse.json({ ok: true });
}
