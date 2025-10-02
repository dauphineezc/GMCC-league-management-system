// /src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

export const runtime = "nodejs"; // important: use the admin SDK on Node

export async function GET() {
  try {
    const cookie = cookies().get("fb:session")?.value; // same name you use elsewhere
    if (!cookie) {
      return NextResponse.json(
        { ok: false, auth: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    // return a compact, non-sensitive view
    return NextResponse.json(
      {
        ok: true,
        auth: {
          uid: decoded.uid,
          email: decoded.email ?? null,
          superadmin: !!(decoded as any).superadmin,
          leagueAdminOf: (decoded as any).leagueAdminOf ?? null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, auth: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}