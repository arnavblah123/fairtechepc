import { NextResponse } from "next/server";
import { checkAdminKey, FeedActError, performFeedAction, resolveOwner } from "@/lib/admin-feed";
import { errorResponse } from "@/lib/api";
import type { FeedActRequest, FeedActResponse } from "@/lib/feed/contract";

export const dynamic = "force-dynamic";

/**
 * One approval / flag action from the owner dashboard, run through the same
 * core functions as the app's own buttons and attributed to the superadmin.
 */
export async function POST(req: Request) {
  const denied = checkAdminKey(req);
  if (denied) return denied;
  let body: FeedActRequest;
  try {
    body = (await req.json()) as FeedActRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON" } satisfies FeedActResponse, { status: 400 });
  }
  if (!body || typeof body !== "object" || !body.actionId) {
    return NextResponse.json({ ok: false, error: "actionId is required" } satisfies FeedActResponse, { status: 400 });
  }
  try {
    const owner = await resolveOwner(body.actor ?? {});
    if (!owner) return NextResponse.json({ ok: false, error: "No active superadmin user to attribute the action to" } satisfies FeedActResponse, { status: 500 });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const result = await performFeedAction(body, { id: owner.id, ip });
    return NextResponse.json(result satisfies FeedActResponse);
  } catch (err) {
    if (err instanceof FeedActError) return NextResponse.json({ ok: false, error: err.message } satisfies FeedActResponse, { status: err.status });
    return errorResponse(err);
  }
}
