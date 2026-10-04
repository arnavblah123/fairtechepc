import { NextResponse } from "next/server";
import { buildAdminFeed, checkAdminKey } from "@/lib/admin-feed";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Owner-dashboard feed (fairtechadmin). Authenticated by the shared
 * `x-admin-key` header, never by a session cookie; exempted in middleware.
 */
export async function GET(req: Request) {
  const denied = checkAdminKey(req);
  if (denied) return denied;
  try {
    const feed = await buildAdminFeed();
    return NextResponse.json(feed, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
