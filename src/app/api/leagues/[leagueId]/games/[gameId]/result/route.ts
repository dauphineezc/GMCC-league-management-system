import { updateGameResult } from "@/lib/repositories/gamesRepo";
import { calculateStandings } from "@/lib/leagueData";
import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { resolveLeagueByRef } from "@/lib/db/resolveLeague";
import type { GameSetScore } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSetScores(raw: unknown): GameSetScore[] | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const sets: GameSetScore[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const homeScore = Number((item as any).homeScore);
    const awayScore = Number((item as any).awayScore);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
    if (homeScore < 0 || awayScore < 0) return null;
    sets.push({ homeScore, awayScore });
  }
  return sets;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leagueId: string; gameId: string }> }
) {
  try {
    const { leagueId, gameId } = await params;
    const auth = await assertLeagueAdmin(leagueId);
    if (isAuthFailure(auth)) return auth.response;

    const league = await resolveLeagueByRef(leagueId);
    if (!league) {
      return new Response("League not found", { status: 404 });
    }

    const body = await req.json();
    const isVolleyball = (league.sport || "").toLowerCase() === "volleyball";

    let homeScore: number;
    let awayScore: number;
    let setScores: GameSetScore[] | null = null;

    if (isVolleyball) {
      setScores = parseSetScores(body.setScores ?? body.sets);
      if (!setScores) {
        return new Response(
          "Invalid scores: volleyball requires exactly 3 games with non-negative scores",
          { status: 400 }
        );
      }
      // Match-level scores derived in repo as games won
      homeScore = 0;
      awayScore = 0;
    } else {
      homeScore = Number(body.homeScore);
      awayScore = Number(body.awayScore);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
        return new Response("Invalid scores: must be numbers", { status: 400 });
      }
      if (homeScore < 0 || awayScore < 0) {
        return new Response("Invalid scores: must be non-negative", { status: 400 });
      }
    }

    const updated = await updateGameResult(
      leagueId,
      gameId,
      homeScore,
      awayScore,
      setScores
    );
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
        homeScore: updated.homeScore,
        awayScore: updated.awayScore,
        setScores: updated.setScores ?? null,
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
