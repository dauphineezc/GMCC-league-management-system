// /src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { getUserDisplayName } from "@/lib/repositories/usersRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await assertAuthenticated();
    if (isAuthFailure(auth)) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = auth.user;

    const displayName = (await getUserDisplayName(user.id)) || user.email || "";

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName,
      superadmin: user.superadmin,
      leagueAdminOf: user.leagueAdminOf,
    });
  } catch (e: any) {
    console.error("Error fetching user:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch user" },
      { status: 500 }
    );
  }
}
