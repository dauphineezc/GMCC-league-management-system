import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { assertAuthenticated, assertLeagueAdminForUser, isAuthFailure } from "@/lib/authGuards";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const auth = await assertAuthenticated();
    if (isAuthFailure(auth)) return auth.response;
    const me = auth.user;

    const { uid } = await params;
    const leagueId = new URL(req.url).searchParams.get("leagueId") || undefined;

    // Authorization: superadmin, self, or league admin when leagueId is provided
    let allowed = me.superadmin || me.id === uid;
    if (!allowed && leagueId) {
      const leagueAuth = await assertLeagueAdminForUser(me, leagueId);
      allowed = !isAuthFailure(leagueAuth);
    }
    if (!allowed) return new NextResponse("Forbidden", { status: 403 });

    // Prefer Firebase Auth
    try {
      const fu = await adminAuth.getUser(uid);
      if (fu.email) {
        return NextResponse.json({ email: fu.email, source: "firebase" });
      }
    } catch {
      // ignore user-not-found; fall through to KV/profile
    }

    // Fallback to KV profile
    const profile = await kv.get<any>(`user:${uid}`);
    if (profile?.email) {
      return NextResponse.json({ email: String(profile.email), source: "kv" });
    }

    // Nothing found
    return NextResponse.json({ email: null, source: "none" }, { status: 404 });
  } catch (e: any) {
    console.error("user-email route error:", e?.message || e);
    return new NextResponse("Server error", { status: 500 });
  }
}