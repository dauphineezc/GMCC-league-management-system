// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";

export function middleware(req: NextRequest) {
  const headerUid = req.headers.get("x-user-id");
  const devUid    = req.cookies.get("dev-user-id")?.value;
  const persisted = req.cookies.get("auth_user")?.value;
  const userId = headerUid || devUid || persisted || uuid();

  const nextHeaders = new Headers(req.headers);
  nextHeaders.set("x-user-id", userId);

  const res = NextResponse.next({ request: { headers: nextHeaders } });
  res.cookies.set("auth_user", userId, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 180 });
  return res;
}

export const config = { matcher: ["/api/:path*", "/admin/:path*"] };
