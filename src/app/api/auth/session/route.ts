import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { clearSessionCookieOptions, createSessionCookieOptions } from "@/lib/sessionCookie";

export async function POST(req: Request) {
  const { idToken } = await req.json();
  if (!idToken) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const decoded = await adminAuth.verifyIdToken(idToken, true);

  const expiresInMs = 1000 * 60 * 60 * 24 * 7;
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: expiresInMs });

  const res = NextResponse.json({ ok: true, uid: decoded.uid });
  const cookie = createSessionCookieOptions(expiresInMs / 1000);
  res.cookies.set({ ...cookie, value: sessionCookie });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  for (const cookie of clearSessionCookieOptions()) {
    res.cookies.set(cookie);
  }
  return res;
}
