// src/app/api/admin/update-game-statuses/route.ts
import { kv } from '@vercel/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseKV(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.trim() ? JSON.parse(raw) : [];
  return [];
}

export async function POST(req: Request) {
  try {
    console.log(`[${new Date().toISOString()}] Starting game status update`);
    
    // For now, check specific known leagues - in production you'd want to track this better
    const knownLeagueIds = ['5v5', '3v3', 'volleyball']; // Add your actual league IDs here
    const leagueIds = knownLeagueIds;
    
    let totalUpdated = 0;
    const now = new Date();
    
    for (const leagueId of leagueIds) {
      const key = `league:${leagueId}:games`;
      
      // Use the same reliable retrieval pattern as other endpoints
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
      let leagueUpdated = 0;
      
      const updatedGames = games.map(game => {
        const gameDate = new Date(game.dateTimeISO || game.date);
        
        // If game date is in the past and status is still 'scheduled'
        if (gameDate < now && (game.status === 'scheduled')) {
          leagueUpdated++;
          return {
            ...game,
            status: 'completed',
          };
        }
        
        return game;
      });
      
      // Only save if there were updates
      if (leagueUpdated > 0) {
        const dataToWrite = JSON.stringify(updatedGames);
        const backupKey = `${key}:backup`;
        
        await Promise.all([
          kv.set(key, dataToWrite),
          kv.set(backupKey, dataToWrite),
        ]);
        
        console.log(`Updated ${leagueUpdated} games in league ${leagueId}`);
        totalUpdated += leagueUpdated;
      }
    }
    
    return new Response(JSON.stringify({ 
      ok: true, 
      message: `Updated ${totalUpdated} games across ${leagueIds.length} leagues`,
      totalUpdated,
      leaguesChecked: leagueIds.length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
    
  } catch (e: any) {
    console.error('Game status update failed:', e);
    return new Response(JSON.stringify({ 
      error: e?.message || 'Failed to update game statuses',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

// Also allow GET for manual testing
export async function GET(req: Request) {
  return POST(req);
}
