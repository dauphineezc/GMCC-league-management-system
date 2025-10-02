// /src/app/api/auth/bootstrap/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { kv } from "@vercel/kv";


export async function POST() {
  const c = cookies();
  const session = c.get("fb:session")?.value;
  if (!session) return NextResponse.json({ ok:false, target:"/login" }, { status: 200 });

  try {
    const dec = await adminAuth.verifySessionCookie(session, true);
    const isSuper = !!dec.superadmin;
    const isAdmin = isSuper || Array.isArray(dec.leagueAdminOf);
    const target = isSuper ? "/superadmin" : isAdmin ? "/admin" : "/player";

    const uid = dec.uid;
    const email = dec.email || null;
    const claims = dec as any;

    // Admin index: prefer UID, else legacy, else claims -> persist to UID
    let managed = await kv.get(`admin:${uid}:leagues`);
    if (!managed && email) managed = await kv.get(`admin:${email}:leagues`);
    if (!managed && Array.isArray(claims.leagueAdminOf)) {
      await kv.set(`admin:${uid}:leagues`, JSON.stringify(claims.leagueAdminOf));
    }

    // Player memberships: if missing, rebuild
    const hasMem = await kv.get(`user:${uid}:memberships`);

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