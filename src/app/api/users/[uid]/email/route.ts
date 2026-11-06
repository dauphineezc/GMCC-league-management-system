import { NextRequest, NextResponse } from "next/server";
import { assertAuthenticated, assertLeagueAdminForUser, isAuthFailure } from "@/lib/authGuards";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getUserDoc, readMembershipsForUid } from "@/lib/repositories/usersRepo";
import { resolveLeagueByRef } from "@/lib/db/resolveLeague";

export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const auth = await assertAuthenticated();
    if (isAuthFailure(auth)) return auth.response;
    const me = auth.user;

    const { uid } = await params;
    const leagueId = new URL(req.url).searchParams.get("leagueId") || undefined;

    let allowed = me.superadmin || me.id === uid;
    if (!allowed && leagueId) {
      const leagueAuth = await assertLeagueAdminForUser(me, leagueId);
      if (!isAuthFailure(leagueAuth)) {
        const league = await resolveLeagueByRef(leagueId);
        const memberships = league ? await readMembershipsForUid(uid) : [];
        allowed = memberships.some((m) => m.leagueId === league?.slug);
      }
    }
    if (!allowed) return new NextResponse("Forbidden", { status: 403 });

    try {
      const fu = await adminAuth.getUser(uid);
      if (fu.email) {
        return NextResponse.json({ email: fu.email, source: "firebase" });
      }
    } catch {
      // ignore user-not-found; fall through to Postgres profile
    }

    const profile = await getUserDoc(uid);
    if (profile?.email) {
      return NextResponse.json({ email: String(profile.email), source: "postgres" });
    }

    return NextResponse.json({ email: null, source: "none" }, { status: 404 });
  } catch (e: any) {
    console.error("user-email route error:", e?.message || e);
    return new NextResponse("Server error", { status: 500 });
  }
}
