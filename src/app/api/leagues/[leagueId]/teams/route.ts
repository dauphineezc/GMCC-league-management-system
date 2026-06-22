// API route to get teams for a league
import { NextRequest } from "next/server";
import { getTeamsForLeague } from "@/lib/kvHelpers";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;

  try {
    const { leagueId } = await params;
    const teams = await getTeamsForLeague(leagueId);

    const rows = teams
      .map((t) => ({ teamId: t.teamId, name: t.name }))
      .filter((t) => t.name)
      .sort((a, b) =>
        (a.name || a.teamId).localeCompare(b.name || b.teamId, undefined, { sensitivity: "base" })
      );

    return Response.json(rows);
  } catch (error: unknown) {
    console.error("Error fetching teams for league:", error);
    return Response.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}
