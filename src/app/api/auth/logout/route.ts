import { NextResponse } from "next/server";
import { applyClearedSessionCookies } from "@/lib/sessionCookie";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url));
  applyClearedSessionCookies(res);
  return res;
}
