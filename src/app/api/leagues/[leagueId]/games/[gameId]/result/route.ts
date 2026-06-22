import { updateGameResult } from "@/lib/repositories/gamesRepo";
import { calculateStandings } from "@/lib/leagueData";
import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leagueId: string; gameId: string }> }
) {
  try {
    const { leagueId, gameId } = await params;
    const auth = await assertLeagueAdmin(leagueId);
    if (isAuthFailure(auth)) return auth.response;

    const { homeScore, awayScore } = await req.json();

    if (typeof homeScore !== "number" || typeof awayScore !== "number") {
      return new Response("Invalid scores: must be numbers", { status: 400 });
    }

    if (homeScore < 0 || awayScore < 0) {
      return new Response("Invalid scores: must be non-negative", { status: 400 });
    }

    const updated = await updateGameResult(leagueId, gameId, homeScore, awayScore);
    if (!updated) {
      return new Response("Game not found", { status: 404 });
    }

    try {
      await calculateStandings(leagueId);
    } catch (standingsError) {
      console.warn("Error recalculating standings:", standingsError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        gameId,
        homeScore,
        awayScore,
        message: "Result saved successfully",
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Error saving game result:", e);
    return new Response(JSON.stringify({ error: e?.message || "Failed to save result" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
