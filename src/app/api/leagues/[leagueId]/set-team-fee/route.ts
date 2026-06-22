import { NextRequest, NextResponse } from "next/server";
import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { revalidatePath } from "next/cache";
import { getTeamIdsForLeague } from "@/lib/kvHelpers";
import { setLeagueTeamsPaymentRequired } from "@/lib/repositories/teamsRepo";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;
    const auth = await assertLeagueAdmin(leagueId);
    if (isAuthFailure(auth)) return auth.response;

    const body = await req.json();
    const { amountCents } = body;

    if (typeof amountCents !== "number" || amountCents < 0) {
      return NextResponse.json({ error: { message: "Invalid amount" } }, { status: 400 });
    }

    const teamIds = await getTeamIdsForLeague(leagueId);
    if (teamIds.length === 0) {
      return NextResponse.json(
        { error: { message: "No teams found in this league" } },
        { status: 404 }
      );
    }

    const teamsUpdated = await setLeagueTeamsPaymentRequired(leagueId, true);

    revalidatePath(`/leagues/${leagueId}`);
    for (const teamId of teamIds) {
      revalidatePath(`/team/${teamId}`);
    }

    return NextResponse.json({
      success: true,
      message: `Team fee of $${(amountCents / 100).toFixed(2)} set for ${teamsUpdated} team(s)`,
      teamsUpdated,
      amountCents,
    });
  } catch (error: any) {
    console.error("Error setting team fee:", error);
    return NextResponse.json(
      { error: { message: error.message || "Internal server error" } },
      { status: 500 }
    );
  }
}
