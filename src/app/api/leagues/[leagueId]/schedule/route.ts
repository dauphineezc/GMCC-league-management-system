import { assertAuthenticated, assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { createScheduledGame } from "@/lib/repositories/gamesRepo";
import { getLeagueTeamNames } from "@/lib/repositories/teamsRepo";
import { getLeagueScheduleView, parseKVArray } from "@/lib/leagueData";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import cpf from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(cpf);

export const runtime = "nodejs";
export const revalidate = 60;

const parseKV = parseKVArray;

export async function GET(req: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;

  try {
    const url = new URL(req.url);
    const teamFilter = url.searchParams.get("team") ?? "";
    const { leagueId } = await params;
    const filtered = await getLeagueScheduleView(leagueId, teamFilter);

    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Failed to read schedule" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  try {
    const { leagueId } = await params;
    const auth = await assertLeagueAdmin(leagueId);
    if (isAuthFailure(auth)) return auth.response;

    const { homeTeamName, awayTeamName, location, date, time, timezone } = await req.json();

    if (!homeTeamName?.trim() || !awayTeamName?.trim()) {
      return new Response(
        JSON.stringify({ error: "Home team and away team names are required" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    if (homeTeamName.trim() === awayTeamName.trim()) {
      return new Response(
        JSON.stringify({ error: "Home team and away team cannot be the same" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
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
      return new Response(JSON.stringify({ error: "Date and time are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (!location?.trim()) {
      return new Response(JSON.stringify({ error: "Location is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const timezoneToUse = timezone || "America/Detroit";
    const dateTimeStr = `${date}T${time}`;
    const startsAt = dayjs.tz(dateTimeStr, timezoneToUse).toDate();

    const newGame = await createScheduledGame({
      leagueRef: leagueId,
      homeTeamName: homeTeamNameTrimmed,
      awayTeamName: awayTeamNameTrimmed,
      location: location.trim(),
      startsAt,
    });

    if (!newGame) {
      return new Response(JSON.stringify({ error: "League not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        gameId: newGame.id,
        message: "Game added successfully",
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Error adding game:", e);
    return new Response(JSON.stringify({ error: e?.message || "Failed to add game" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
