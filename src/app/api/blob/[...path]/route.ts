import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { openPrivateBlob } from "@/lib/storage";

/**
 * Serves photos kept in a PRIVATE Blob store. Only logged-in users get them,
 * and the browser may cache each one for a year since blob names never change.
 */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    await requireUser();
    const { path: parts } = await ctx.params;
    const pathname = parts.map((p) => p.replace(/[^a-zA-Z0-9._-]/g, "")).join("/");
    const r = await openPrivateBlob(pathname, req.headers.get("if-none-match"));
    if (!r) return new Response("Not found", { status: 404 });
    const headers = new Headers({ "Cache-Control": "private, max-age=31536000, immutable", ETag: r.blob.etag });
    if (r.statusCode === 304) return new Response(null, { status: 304, headers });
    headers.set("Content-Type", r.blob.contentType);
    headers.set("Content-Length", String(r.blob.size));
    return new Response(r.stream, { status: 200, headers });
  } catch (e) {
    return errorResponse(e);
  }
}
