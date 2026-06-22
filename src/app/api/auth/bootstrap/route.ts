// /src/app/api/auth/bootstrap/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import {
  migrateEmailAdminKeyToUid,
  readAdminLeagueIds,
  writeAdminLeaguesAsSet,
} from "@/lib/adminLeaguesMigration";
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

    // Admin index: migrate legacy email key → uid SET; seed from claims if empty
    if (email) {
      await migrateEmailAdminKeyToUid(email, uid, { deleteLegacy: true });
    }
    if (Array.isArray(claims.leagueAdminOf) && claims.leagueAdminOf.length) {
      const uidKey = `admin:${uid}:leagues`;
      const existing = await readAdminLeagueIds(uidKey);
      if (!existing.length) {
        await writeAdminLeaguesAsSet(uidKey, claims.leagueAdminOf);
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