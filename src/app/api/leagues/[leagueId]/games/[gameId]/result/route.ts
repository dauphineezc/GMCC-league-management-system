// src/app/api/leagues/[leagueId]/games/[gameId]/result/route.ts
import { kv } from '@vercel/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseKV(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.trim() ? JSON.parse(raw) : [];
  return [];
}

export async function POST(
  req: Request, 
  { params }: { params: { leagueId: string; gameId: string } }
) {
  try {
    const { homeScore, awayScore } = await req.json();
    const { leagueId, gameId } = params;

    // Validate input
    if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
      return new Response('Invalid scores: must be numbers', { status: 400 });
    }

    if (homeScore < 0 || awayScore < 0) {
      return new Response('Invalid scores: must be non-negative', { status: 400 });
    }

    console.log(`Updating result for game ${gameId}: ${homeScore}-${awayScore}`);

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

    // Update the game with scores and set status to final
    games[gameIndex] = {
      ...games[gameIndex],
      homeScore,
      awayScore,
      status: 'final', // Update status to final when scores are entered
    };

    // Save updated games
    const dataToWrite = JSON.stringify(games);
    const backupKey = `${key}:backup`;
    
    await Promise.all([
      kv.set(key, dataToWrite),
      kv.set(backupKey, dataToWrite),
    ]);

    console.log(`Successfully updated game ${gameId} result: ${homeScore}-${awayScore}`);

    // Automatically recalculate standings after saving result
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const standingsUrl = `${baseUrl}/api/leagues/${leagueId}/standings/calculate`;
      const standingsResponse = await fetch(standingsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (standingsResponse.ok) {
        console.log('Standings automatically updated after result save');
      } else {
        console.warn('Failed to auto-update standings:', standingsResponse.status);
      }
    } catch (standingsError) {
      console.warn('Error auto-updating standings:', standingsError);
      // Don't fail the main request if standings update fails
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      gameId,
      homeScore,
      awayScore,
      message: 'Result saved successfully'
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Error saving game result:', e);
    return new Response(JSON.stringify({ 
      error: e?.message || 'Failed to save result' 
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}