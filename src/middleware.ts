import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/api/auth/login", "/setup", "/api/setup", "/manifest.webmanifest", "/icon.svg"];

/** Cheap gate: no cookie -> login. Real role checks happen in pages and API routes. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  const hasCookie = req.cookies.has("ft_session");
  if (hasCookie) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webmanifest)$).*)"],
};
