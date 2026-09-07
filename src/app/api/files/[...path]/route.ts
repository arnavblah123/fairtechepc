import { readFile } from "fs/promises";
import path from "path";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

/** Serves locally stored uploads in development (production uses Vercel Blob URLs). */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    await requireUser();
    const { path: parts } = await ctx.params;
    const name = parts.join("_").replace(/[^a-zA-Z0-9._-]/g, "");
    const buf = await readFile(path.join(process.cwd(), ".uploads", name));
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": name.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "private, max-age=31536000" } });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "ENOENT") return new Response("Not found", { status: 404 });
    return errorResponse(e);
  }
}
