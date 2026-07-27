import { NextResponse } from "next/server";
import { clearSessionCookieOptions } from "@/lib/sessionCookie";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url));
  for (const cookie of clearSessionCookieOptions()) {
    res.cookies.set(cookie);
  }
  return res;
}
