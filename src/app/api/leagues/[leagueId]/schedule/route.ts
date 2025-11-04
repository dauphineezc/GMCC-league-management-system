// /src/app/api/leagues/[leagueId]/schedule/route.ts

import { kv } from "@vercel/kv";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
import cpf from 'dayjs/plugin/customParseFormat';
import { batchGetTeamNames } from '@/lib/kvBatch';

dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(cpf);

export const runtime = "nodejs";
// OPTIMIZED: Use revalidation instead of force-dynamic
export const revalidate = 60; // Revalidate every 60 seconds

const COMPLETION_GRACE_MINUTES = 120; // how long after scheduled start we consider it "completed"

function parseKV(raw: unknown): any[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = raw.trim() ? JSON.parse(raw) : [];
    return parsed;
  }
  return [];
}

function toNewShape(g: any, idToName: Map<string, string>) {
  const dateTimeISO = g.dateTimeISO || g.date || g.startTimeISO || g.start || null;
  const location = g.location || g.court || g.venue || "";
  const homeTeamName =
    g.homeTeamName || g.homeName || (g.homeTeamId ? idToName.get(g.homeTeamId) : "") || "";
  const awayTeamName =
    g.awayTeamName || g.awayName || (g.awayTeamId ? idToName.get(g.awayTeamId) : "") || "";

  // Check if results have been entered
  const hasResults = (g.score?.home != null && g.score?.away != null) || (g.homeScore != null && g.awayScore != null);

  // normalize raw status first
  const statusRaw = (g.status || "scheduled") + "";
  let status =
    /final/i.test(statusRaw) ? "final"
    : /canceled/i.test(statusRaw) ? "canceled"
    : /completed/i.test(statusRaw) ? "completed"
    : "scheduled";

  // Auto-classify past scheduled games as completed if:
  // 1. Status is "scheduled" (whether set manually or automatically)
  // 2. Game time has passed + grace period
  // 3. Results have NOT been entered (once results are in, status becomes "final")
  // 4. NOT canceled (canceled games stay canceled)
  if (status === "scheduled" && !hasResults && dateTimeISO) {
    const start = new Date(dateTimeISO).getTime();
    const now   = Date.now();
    if (Number.isFinite(start) && start + COMPLETION_GRACE_MINUTES * 60_000 < now) {
      status = "completed";
    }
  }

  return {
    id: g.id || `game:${g.leagueId || ""}:${dateTimeISO || ""}:${homeTeamName}-${awayTeamName}`,
    leagueId: g.leagueId,
    dateTimeISO,
    location,
    homeTeamName,
    awayTeamName,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    status,
    homeScore: g.score?.home ?? g.homeScore,
    awayScore: g.score?.away ?? g.awayScore,
  };
}

export async function GET(req: Request, { params }: { params: { leagueId: string } }) {
  try {
    const url = new URL(req.url);
    const teamFilter = url.searchParams.get("team") ?? "";
    const leagueId = params.leagueId;

    // Use the same reliable pattern as PDFs
    const key = `league:${leagueId}:games`;
    
    let rawGames = await kv.get(key);
    
    // Always try REST API since it's more reliable
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body?.result) {
        const restGames = parseKV(body.result);
        const sdkGames = parseKV(rawGames);
        if (restGames.length >= sdkGames.length) {
          rawGames = body.result;
        }
      }
    }
    
    const gamesArr = parseKV(rawGames);
    const sourceGames = gamesArr;

    const teamIds = Array.from(
      new Set(
        sourceGames
          .flatMap((g) => [g.homeTeamId, g.awayTeamId])
          .filter(Boolean) as string[]
      )
    );

    // OPTIMIZED: Batch fetch team names instead of N individual queries
    const idToName = await batchGetTeamNames(teamIds);

    const deduped = sourceGames.map((g) => toNewShape(g, idToName));

    const filtered = teamFilter
      ? deduped.filter(
          (g) =>
            g.homeTeamName === teamFilter ||
            g.awayTeamName === teamFilter ||
            g.homeTeamId === teamFilter ||
            g.awayTeamId === teamFilter
        )
      : deduped;

    filtered.sort((a, b) => String(a.dateTimeISO).localeCompare(String(b.dateTimeISO)));

    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // OPTIMIZED: Cache for 60 seconds, revalidate in background
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Failed to read schedule" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

export async function POST(req: Request, { params }: { params: { leagueId: string } }) {
  try {
    const { homeTeamName, awayTeamName, location, date, time, timezone } = await req.json();
    const { leagueId } = params;

    // Validate input
    if (!homeTeamName?.trim() || !awayTeamName?.trim()) {
      return new Response(JSON.stringify({ error: 'Home team and away team names are required' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    if (homeTeamName.trim() === awayTeamName.trim()) {
      return new Response(JSON.stringify({ error: 'Home team and away team cannot be the same' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    if (!date || !time) {
      return new Response(JSON.stringify({ error: 'Date and time are required' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    if (!location?.trim()) {
      return new Response(JSON.stringify({ error: 'Location is required' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    console.log(`Adding new game: ${homeTeamName} vs ${awayTeamName} on ${date} at ${time}`);

    const key = `league:${leagueId}:games`;
    
    // Use reliable retrieval pattern
    let raw = await kv.get(key);
    if (!raw && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body?.result) {
        raw = body.result;
      }
    }

    const games = parseKV(raw);
    
    // Create new dateTimeISO from date and time
    const timezoneToUse = timezone || 'America/Detroit';
    const dateTimeStr = `${date}T${time}`;
    const dateTimeISO = dayjs.tz(dateTimeStr, timezoneToUse).toISOString();

    // Create new game
    const newGame = {
      id: crypto.randomUUID(),
      leagueId,
      homeTeamName: homeTeamName.trim(),
      awayTeamName: awayTeamName.trim(),
      location: location.trim(),
      dateTimeISO,
      status: 'scheduled'
    };

    // Add the new game
    games.push(newGame);

    // Save updated games
    const dataToWrite = JSON.stringify(games);
    const backupKey = `${key}:backup`;
    
    await Promise.all([
      kv.set(key, dataToWrite),
      kv.set(backupKey, dataToWrite),
    ]);

    console.log(`Successfully added game ${newGame.id}`);

    return new Response(JSON.stringify({ 
      ok: true, 
      gameId: newGame.id,
      message: 'Game added successfully'
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Error adding game:', e);
    return new Response(JSON.stringify({ 
      error: e?.message || 'Failed to add game' 
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}