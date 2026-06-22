// DELETE remove player from team
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { PermissionChecker } from "@/lib/permissions";
import { removePlayerFromTeam } from "@/server/memberships";
import {
  getTeamById,
  getTeamRosterMeta,
  isUserTeamManager,
  setTeamManager,
} from "@/lib/repositories/teamsRepo";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;
  const user = auth.user;

  const { teamId } = await params;
  const body = await req.json();
  let { userId } = body;
  const { newManagerId } = body;

  if (userId === "self") {
    userId = user.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const team = await getTeamById(teamId);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const leagueId = typeof team.leagueId === "string" ? team.leagueId : "";
    const permissions = await PermissionChecker.create(user, leagueId);
    const { roster, managerCount } = await getTeamRosterMeta(teamId);
    const isTeamManager = await isUserTeamManager(teamId, user.id);
    const isSelfRemoval = userId === user.id;

    if (!isSelfRemoval && !permissions.isAdmin() && !isTeamManager) {
      return NextResponse.json(
        { error: "Only admins, team managers, or the player themselves can remove a player" },
        { status: 403 }
      );
    }

    if (isSelfRemoval && isTeamManager) {
      if (managerCount === 1 && !newManagerId) {
        return NextResponse.json(
          {
            error:
              "Cannot leave team: You are the only manager. Please assign another manager first.",
          },
          { status: 400 }
        );
      }
    }

    if (newManagerId) {
      const newManager = roster.find((r) => r.userId === newManagerId);
      if (!newManager) {
        return NextResponse.json({ error: "New manager not found on roster" }, { status: 400 });
      }
      await setTeamManager(teamId, newManagerId);
    }

    await removePlayerFromTeam(userId, teamId);

    return NextResponse.json({
      success: true,
      message: isSelfRemoval ? "Successfully left the team" : "Player removed successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to remove player" },
      { status: 500 }
    );
  }
}
