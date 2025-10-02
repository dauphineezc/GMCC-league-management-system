import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

const COOKIE = "fb:session";
const isProd = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
  const { idToken } = await req.json();
  if (!idToken) return NextResponse.json({ error: "missing token" }, { status: 400 });

  // Optional but recommended: verify before issuing a cookie
  const decoded = await adminAuth.verifyIdToken(idToken, true);

  // 7 days; adjust as you like
  const expiresInMs = 1000 * 60 * 60 * 24 * 7;
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: expiresInMs });

  const res = NextResponse.json({ ok: true, uid: decoded.uid });
  res.cookies.set({
    name: COOKIE,
    value: sessionCookie,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: expiresInMs / 1000,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE,
    value: "",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}