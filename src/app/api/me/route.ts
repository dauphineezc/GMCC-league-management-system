// /src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";

export const runtime = "nodejs";

export async function GET() {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) {
    return NextResponse.json(
      { ok: false, auth: null },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const user = auth.user;
  return NextResponse.json(
    {
      ok: true,
      auth: {
        uid: user.id,
        email: user.email,
        superadmin: user.superadmin,
        leagueAdminOf: user.leagueAdminOf ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}