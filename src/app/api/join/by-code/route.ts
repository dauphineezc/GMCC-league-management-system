// POST join via code
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { readLeagueDocJSON } from "@/lib/leagueDoc";
import { readMembershipsForUid } from "@/lib/repositories/usersRepo";
import { getTeamById, getTeamRosterMeta } from "@/lib/repositories/teamsRepo";
import { consumeCodeInvite } from "@/server/invites";
import { addPlayerToTeam } from "@/server/memberships";

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
    const teamId = await consumeCodeInvite(code, user.id);
    const team = await getTeamById(teamId);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const leagueId = typeof team.leagueId === "string" ? team.leagueId : null;

    if (leagueId) {
      const league = await readLeagueDocJSON(leagueId);
      if (league?.playerAddDeadline) {
        const deadlinePassed = new Date(String(league.playerAddDeadline)) < new Date();
        const overrideActive = Boolean(league.playerAddDeadlineOverride);
        if (deadlinePassed && !overrideActive) {
          return NextResponse.json(
            {
              error:
                "The player add deadline for this league has passed. This invite code is no longer valid.",
            },
            { status: 403 }
          );
        }
      }
    }

    const memberships = await readMembershipsForUid(user.id);
    if (leagueId && memberships.some((m) => m.leagueId === leagueId)) {
      return NextResponse.json({ error: "Already on a team" }, { status: 409 });
    }

    const { size: rosterSize } = await getTeamRosterMeta(teamId);
    const rosterLimit = 8;
    if (rosterSize >= rosterLimit) {
      return NextResponse.json({ error: "Team is full" }, { status: 400 });
    }

    await addPlayerToTeam(user.id, teamId);

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
