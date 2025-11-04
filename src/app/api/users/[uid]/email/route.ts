import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import { adminAuth } from "@/lib/firebaseAdmin";

// Keep in sync with your actions.ts check
async function isAdminOfLeague(userId: string, leagueId?: string) {
  if (!leagueId) return false;
  try {
    if (await kv.sismember<string>(`league:${leagueId}:admins`, userId)) return true;
  } catch {}
  try {
    if (await kv.sismember<string>(`admin:${userId}:leagues`, leagueId)) return true;
  } catch {}
  // legacy JSON list
  try {
    const val = await kv.get<any>(`admin:${userId}:leagues`);
    if (Array.isArray(val)) return val.includes(leagueId);
    if (typeof val === "string") {
      const arr = JSON.parse(val);
      if (Array.isArray(arr)) return arr.includes(leagueId);
    }
  } catch {}
  return false;
}

export async function GET(req: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const me = await getServerUser();
    if (!me) return new NextResponse("Unauthorized", { status: 401 });

    const uid = params.uid;
    const leagueId = new URL(req.url).searchParams.get("leagueId") || undefined;

    // Authorization: you're allowed if you're superadmin, the user yourself, or an admin of the league
    const allowed = me.superadmin || me.id === uid || (await isAdminOfLeague(me.id, leagueId));
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