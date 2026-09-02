import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { errorResponse, parseBody } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, loginSchema);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const user = await login(body.username, body.password, ip);
    if (!user) return NextResponse.json({ error: "Wrong username or password / गलत यूज़रनेम या पासवर्ड" }, { status: 401 });
    return NextResponse.json({ ok: true, role: user.role });
  } catch (e) {
    return errorResponse(e);
  }
}
