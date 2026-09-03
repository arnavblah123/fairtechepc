import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runSeed } from "@/lib/seed-data";
import { errorResponse, parseBody } from "@/lib/api";
import { usernameSchema, passwordSchema } from "@/lib/validation";
import { createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  username: usernameSchema,
  password: passwordSchema,
  sampleData: z.boolean().default(true),
});

/**
 * One-time first-run setup. Only works while the database has zero users,
 * so it can never be used to add an admin to a live system.
 */
export async function POST(req: Request) {
  try {
    if ((await prisma.user.count()) > 0) return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
    const body = await parseBody(req, schema);
    const { admin } = await runSeed(prisma, { adminUsername: body.username, adminPassword: body.password, adminName: body.name, sampleData: body.sampleData });
    await audit({ userId: admin.id, action: "CREATE", entity: "Setup", entityId: admin.id, newValues: { sampleData: body.sampleData } });
    await createSession(admin.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
