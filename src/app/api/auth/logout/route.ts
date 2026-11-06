import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE, applyClearedSessionCookies } from "@/lib/sessionCookie";

// POST only: a GET logout can be triggered by any page that links or embeds it.
export async function POST() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session);
      // Firebase cannot revoke a single session, so this signs out every device.
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Expired or invalid cookie: nothing to revoke, still clear it below.
    }
  }

  const res = NextResponse.json({ ok: true });
  applyClearedSessionCookies(res);
  return res;
}
