import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Must be superadmin via session cookie
  const cookie = cookies().get("fb:session")?.value;
  if (!cookie) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const caller = await adminAuth.verifySessionCookie(cookie, true);
  if (!caller.superadmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { uidOrEmail, patch } = await req.json() as {
    uidOrEmail: string;
    patch: Partial<{ superadmin: boolean; leagueAdminOf: string[] }>;
  };

  // Resolve uid
  let uid = uidOrEmail;
  if (uid.includes("@")) {
    const u = await adminAuth.getUserByEmail(uid);
    uid = u.uid;
  }

  const u = await adminAuth.getUser(uid);
  const current = (u.customClaims ?? {}) as any;

  // Merge-with-replacement for arrays; omit undefined keys
  const next: any = { ...current };
  if ("superadmin" in patch) next.superadmin = !!patch.superadmin;
  if ("leagueAdminOf" in patch) next.leagueAdminOf = patch.leagueAdminOf ?? [];

  await adminAuth.setCustomUserClaims(uid, next);
  return NextResponse.json({ ok: true, uid, claims: next });
}