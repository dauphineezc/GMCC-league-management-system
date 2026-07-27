import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/sessionCookie";

export async function POST(req: Request) {
  const { idToken, embedded: embeddedBody } = await req.json();
  if (!idToken) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const embedded = Boolean(embeddedBody);

  const decoded = await adminAuth.verifyIdToken(idToken, true);

  const expiresInMs = 1000 * 60 * 60 * 24 * 7;
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: expiresInMs });

  const res = NextResponse.json({ ok: true, uid: decoded.uid });
  const cookie = sessionCookieOptions(embedded, expiresInMs / 1000);
  res.cookies.set({ ...cookie, value: sessionCookie });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...sessionCookieOptions(false, 0), value: "" });
  res.cookies.set({ ...sessionCookieOptions(true, 0), value: "" });
  return res;
}