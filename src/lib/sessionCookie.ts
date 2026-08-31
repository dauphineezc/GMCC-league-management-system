import { stringifyCookie } from "next/dist/compiled/@edge-runtime/cookies";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "fb:session";

const isProd = process.env.NODE_ENV === "production";

export function clearSessionCookieOptions(): ResponseCookie[] {
  return [
    {
      name: SESSION_COOKIE,
      value: "",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    },
    {
      name: SESSION_COOKIE,
      value: "",
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      maxAge: 0,
      path: "/",
    },
  ];
}

/**
 * Next.js ResponseCookies stores cookies in a Map keyed by name, so calling
 * cookies.set() twice for "fb:session" only keeps the last entry. Append both
 * clear headers so Lax and Partitioned variants are both expired.
 */
export function applyClearedSessionCookies(res: NextResponse): void {
  for (const cookie of clearSessionCookieOptions()) {
    res.headers.append("Set-Cookie", stringifyCookie(cookie));
  }
}

export function createSessionCookieOptions(maxAge: number): ResponseCookie {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge,
    path: "/",
  };
}
