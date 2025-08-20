// Mock auth: sets/reads x-user-id + cookie
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";

export function middleware(req: NextRequest) {
  // If you only want to run this on certain paths, keep using `config.matcher` below.
  const url = req.nextUrl;

  // Sources of truth for a user id (in priority order)
  const headerUid = req.headers.get("x-user-id") || null;           // e.g., from a proxy or real auth
  const devUid    = req.cookies.get("dev-user-id")?.value || null;  // manual dev cookie for local testing
  const persisted = req.cookies.get("auth_user")?.value || null;    // our own sticky cookie

  // Mint a UUID if nothing is present (dev convenience)
  const userId = headerUid || devUid || persisted || uuid();

  // Propagate x-user-id to downstream request so `headers()` in RSC/API can read it
  const nextHeaders = new Headers(req.headers);
  nextHeaders.set("x-user-id", userId);

  const res = NextResponse.next({ request: { headers: nextHeaders } });

  // Persist/refresh our cookie for convenience (non-HTTPOnly for quick dev testing)
  res.cookies.set("auth_user", userId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180, // 180 days
  });

  return res;
}

// Where should middleware run?
export const config = {
  // If you only need it for API routes, keep this:
  // matcher: ["/api/:path*"]

  // If you also want Server Components (e.g., /admin) to see x-user-id via headers(),
  // widen the matcher to cover those pages too:
  matcher: ["/api/:path*", "/admin/:path*"],
}