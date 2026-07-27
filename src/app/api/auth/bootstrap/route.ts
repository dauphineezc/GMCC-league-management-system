// /src/app/api/auth/bootstrap/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import {
  listLeagueRefsForAdminUser,
  syncLeagueAdminsFromRefs,
} from "@/lib/repositories/leaguesRepo";
import { resolveManagedLeagueIds } from "@/lib/kvHelpers";

export async function POST() {
  const c = await cookies();
  const session = c.get("fb:session")?.value;
  if (!session) return NextResponse.json({ ok:false, target:"/login" }, { status: 200 });

  try {
    const dec = await adminAuth.verifySessionCookie(session, true);
    const uid = dec.uid;
    const email = dec.email || null;
    const claims = dec as any;

    const isSuper = !!dec.superadmin;
    const managed = await resolveManagedLeagueIds({
      id: uid,
      email,
      leagueAdminOf: Array.isArray(claims.leagueAdminOf) ? claims.leagueAdminOf : undefined,
    });
    const isAdmin = isSuper || managed.length > 0;
    const target = isSuper ? "/superadmin" : isAdmin ? "/admin" : "/player";

    // Seed Postgres league_admins from Firebase claims when the user has none yet
    if (Array.isArray(claims.leagueAdminOf) && claims.leagueAdminOf.length) {
      const existing = await listLeagueRefsForAdminUser(uid);
      if (!existing.length) {
        await syncLeagueAdminsFromRefs(uid, claims.leagueAdminOf);
      }
    }

    return NextResponse.json({
      ok: true,
      roles: {
        superadmin: isSuper,
        leagueAdminOf: Array.isArray(dec.leagueAdminOf) ? dec.leagueAdminOf : null,
      },
      target,
    });
  } catch {
    return NextResponse.json({ ok:false, target:"/login" }, { status: 200 });
  }
}
