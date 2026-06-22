import { NextResponse } from "next/server";
import { assertSuperAdmin, isAuthFailure } from "@/lib/authGuards";
import { assignTeamToLeagueRef, getTeamById } from "@/lib/repositories/teamsRepo";

export async function POST(req: Request) {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const body = await req.json().catch(() => ({}));
  const teamId = String(body.teamId || "");
  const leagueId = String(body.leagueId || "");
  if (!teamId || !leagueId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const team = await getTeamById(teamId);
  if (!team) return NextResponse.json({ error: "team not found" }, { status: 404 });

  await assignTeamToLeagueRef(teamId, leagueId);
  return NextResponse.json({ ok: true });
}
