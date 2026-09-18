import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "fb:session";

/** Endpoints that are intentionally public (no session required). */
const PUBLIC_API_PATHS = new Set([
  "/api/auth/session",
  "/api/auth/logout",
  "/api/admin/claims",
]);

/** Dynamic public paths (e.g. league schedule PDF for signed-out viewers). */
function isPublicApiPath(pathname: string, method: string): boolean {
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  // Schedule PDF + metadata — published for public viewing without sign-in
  if (
    (method === "GET" || method === "HEAD") &&
    /^\/api\/leagues\/[^/]+\/schedule\/pdf(?:-info)?$/.test(pathname)
  ) {
    return true;
  }
  return false;
}

/** POST paths that accept CRON_SECRET bearer instead of a session cookie. */
function isCronBearerPath(pathname: string): boolean {
  if (pathname === "/api/admin/update-game-statuses") return true;
  return false;
}

function hasValidCronBearer(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Block dev/debug tooling in production
  if (process.env.NODE_ENV === "production") {
    if (pathname.startsWith("/api/dev/") || pathname.startsWith("/api/debug/")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // Cron routes validate CRON_SECRET in the handler
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  if (isPublicApiPath(pathname, request.method)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const cronBearerOk = hasValidCronBearer(request);

  if (isCronBearerPath(pathname) && cronBearerOk) {
    return NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
