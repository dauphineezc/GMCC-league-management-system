import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  const cookie = cookies().get("fb:session")?.value;
  if (!cookie) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = await adminAuth.verifySessionCookie(cookie, true);

  const { leagueId } = await req.json();
  if (!user.leagueAdminOf?.includes(leagueId) && !user.superadmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ... perform write ...
  return NextResponse.json({ ok: true });
}