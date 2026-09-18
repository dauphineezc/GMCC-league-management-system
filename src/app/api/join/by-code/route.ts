// POST join via code
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { peekCodeInvite } from "@/server/invites";
import { acceptInviteForUser } from "@/server/acceptInvite";

export async function POST(req: NextRequest) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) {
    return NextResponse.json({ error: "Please sign in to join a team" }, { status: 401 });
  }
  const user = auth.user;

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  try {
    const invite = await peekCodeInvite(code);
    const { teamId, team } = await acceptInviteForUser(user.id, invite);

    return NextResponse.json({
      ok: true,
      team: {
        id: teamId,
        name: team.name,
        leagueId: team.leagueId ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
