// src/app/api/leagues/[leagueId]/schedule/[gameId]/route.ts
import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import {
  deleteGame,
  getGameById,
  updateScheduledGameDetails,
} from "@/lib/repositories/gamesRepo";
import { getLeagueTeamNames } from "@/lib/repositories/teamsRepo";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import cpf from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(cpf);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ leagueId: string; gameId: string }> }
) {
  try {
    const { leagueId, gameId } = await params;
    const auth = await assertLeagueAdmin(leagueId);
    if (isAuthFailure(auth)) return auth.response;

    const { homeTeamName, awayTeamName, location, date, time, timezone, status } =
      await req.json();

    if (!homeTeamName?.trim() || !awayTeamName?.trim()) {
      return new Response("Home team and away team names are required", { status: 400 });
    }

    if (homeTeamName.trim() === awayTeamName.trim()) {
      return new Response("Home team and away team cannot be the same", { status: 400 });
    }

    const leagueTeamNames = await getLeagueTeamNames(leagueId);
    const homeTeamNameTrimmed = homeTeamName.trim();
    const awayTeamNameTrimmed = awayTeamName.trim();

    if (!leagueTeamNames.has(homeTeamNameTrimmed)) {
      return new Response(
        JSON.stringify({
          error: `Home team "${homeTeamNameTrimmed}" is not in this league. Please select a team from the dropdown.`,
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    if (!leagueTeamNames.has(awayTeamNameTrimmed)) {
      return new Response(
        JSON.stringify({
          error: `Away team "${awayTeamNameTrimmed}" is not in this league. Please select a team from the dropdown.`,
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    if (!date || !time) {
      return new Response("Date and time are required", { status: 400 });
    }

    if (!location?.trim()) {
      return new Response("Location is required", { status: 400 });
    }

    const existing = await getGameById(leagueId, gameId);
    if (!existing) {
      return new Response("Game not found", { status: 404 });
    }

    const timezoneToUse = timezone || "America/Detroit";
    const dateTimeStr = `${date}T${time}`;
    const startsAt = dayjs.tz(dateTimeStr, timezoneToUse).toDate();

    const updated = await updateScheduledGameDetails({
      leagueRef: leagueId,
      gameId,
      homeTeamName: homeTeamNameTrimmed,
      awayTeamName: awayTeamNameTrimmed,
      location: location.trim(),
      startsAt,
      status,
    });

    if (!updated) {
      return new Response("Game not found", { status: 404 });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        gameId,
        message: "Game updated successfully",
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Error updating game:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Failed to update game" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ leagueId: string; gameId: string }> }
) {
  try {
    const { leagueId, gameId } = await params;
    const auth = await assertLeagueAdmin(leagueId);
    if (isAuthFailure(auth)) return auth.response;

    const deleted = await deleteGame(leagueId, gameId);
    if (!deleted) {
      return new Response("Game not found", { status: 404 });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        gameId,
        message: "Game deleted successfully",
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Error deleting game:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Failed to delete game" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
