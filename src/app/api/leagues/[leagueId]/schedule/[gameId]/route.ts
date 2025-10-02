// src/app/api/leagues/[leagueId]/schedule/[gameId]/route.ts
import { kv } from '@vercel/kv';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
import cpf from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(cpf);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseKV(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.trim() ? JSON.parse(raw) : [];
  return [];
}

export async function PUT(
  req: Request, 
  { params }: { params: { leagueId: string; gameId: string } }
) {
  try {
    const { homeTeamName, awayTeamName, location, date, time, timezone } = await req.json();
    const { leagueId, gameId } = params;

    // Validate input
    if (!homeTeamName?.trim() || !awayTeamName?.trim()) {
      return new Response('Home team and away team names are required', { status: 400 });
    }

    if (homeTeamName.trim() === awayTeamName.trim()) {
      return new Response('Home team and away team cannot be the same', { status: 400 });
    }

    if (!date || !time) {
      return new Response('Date and time are required', { status: 400 });
    }

    if (!location?.trim()) {
      return new Response('Location is required', { status: 400 });
    }

    console.log(`Updating game ${gameId}: ${homeTeamName} vs ${awayTeamName} on ${date} at ${time}`);

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
    
    // Find and update the game
    const gameIndex = games.findIndex(g => g.id === gameId);
    if (gameIndex === -1) {
      return new Response('Game not found', { status: 404 });
    }

    // Create new dateTimeISO from date and time
    const timezoneToUse = timezone || 'America/Detroit';
    const dateTimeStr = `${date}T${time}`;
    const dateTimeISO = dayjs.tz(dateTimeStr, timezoneToUse).toISOString();

    // Update the game with new details
    games[gameIndex] = {
      ...games[gameIndex],
      homeTeamName: homeTeamName.trim(),
      awayTeamName: awayTeamName.trim(),
      location: location.trim(),
      dateTimeISO,
    };

    // Save updated games
    const dataToWrite = JSON.stringify(games);
    const backupKey = `${key}:backup`;
    
    await Promise.all([
      kv.set(key, dataToWrite),
      kv.set(backupKey, dataToWrite),
    ]);

    console.log(`Successfully updated game ${gameId}`);

    return new Response(JSON.stringify({ 
      ok: true, 
      gameId,
      message: 'Game updated successfully'
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Error updating game:', e);
    return new Response(JSON.stringify({ 
      error: e?.message || 'Failed to update game' 
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

export async function DELETE(
  req: Request, 
  { params }: { params: { leagueId: string; gameId: string } }
) {
  try {
    const { leagueId, gameId } = params;

    console.log(`Deleting game ${gameId}`);

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
    
    // Find and remove the game
    const gameIndex = games.findIndex(g => g.id === gameId);
    if (gameIndex === -1) {
      return new Response('Game not found', { status: 404 });
    }

    // Remove the game
    games.splice(gameIndex, 1);

    // Save updated games
    const dataToWrite = JSON.stringify(games);
    const backupKey = `${key}:backup`;
    
    await Promise.all([
      kv.set(key, dataToWrite),
      kv.set(backupKey, dataToWrite),
    ]);

    console.log(`Successfully deleted game ${gameId}`);

    return new Response(JSON.stringify({ 
      ok: true, 
      gameId,
      message: 'Game deleted successfully'
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Error deleting game:', e);
    return new Response(JSON.stringify({ 
      error: e?.message || 'Failed to delete game' 
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
