import { NextResponse } from "next/server";
import { assertSuperAdmin, isAuthFailure } from "@/lib/authGuards";
import { adminAuth } from "@/lib/firebaseAdmin";
import { setClaimsAndRevokeSessions } from "@/lib/roleRevocation";
import { UNVERIFIED_EMAIL_MESSAGE } from "@/lib/verifiedEmail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

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

  const grantsRole =
    patch.superadmin === true ||
    (Array.isArray(patch.leagueAdminOf) && patch.leagueAdminOf.length > 0);
  if (grantsRole && u.emailVerified !== true) {
    return NextResponse.json({ error: UNVERIFIED_EMAIL_MESSAGE }, { status: 400 });
  }

  await setClaimsAndRevokeSessions(uid, next);
  return NextResponse.json({ ok: true, uid, claims: next });
}