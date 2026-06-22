// API endpoint to update team description
import { NextRequest, NextResponse } from "next/server";
import { assertAuthenticated, assertLeagueAdminForUser, isAuthFailure } from "@/lib/authGuards";
import { revalidatePath } from "next/cache";
import {
  getTeamById,
  isUserTeamManager,
  updateTeamDescription,
} from "@/lib/repositories/teamsRepo";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;
  const user = auth.user;

  const { teamId } = await params;

  try {
    const team = await getTeamById(teamId);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const leagueId = typeof team.leagueId === "string" ? team.leagueId : "";
    const isTeamManager = await isUserTeamManager(teamId, user.id);

    const leagueAuth = leagueId
      ? await assertLeagueAdminForUser(user, leagueId)
      : null;
    const isAdmin = leagueAuth ? !isAuthFailure(leagueAuth) : false;

    if (!isAdmin && !isTeamManager) {
      return NextResponse.json(
        { error: "Only team managers or admins can update the team description" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { description } = body;

    if (typeof description !== "string") {
      return NextResponse.json({ error: "Description must be a string" }, { status: 400 });
    }

    await updateTeamDescription(teamId, description);

    revalidatePath(`/team/${teamId}`);
    if (leagueId) {
      revalidatePath(`/leagues/${leagueId}`);
    }

    return NextResponse.json({
      success: true,
      description: description.trim(),
    });
  } catch (error: any) {
    console.error("Error updating team description:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
