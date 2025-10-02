import { kv } from '@vercel/kv';

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const leagueId = url.searchParams.get('leagueId');
    
    if (!leagueId) {
      return new Response(JSON.stringify({ error: 'leagueId parameter required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Clear both stores to be safe
    const gamesKey = `league:${leagueId}:games`;
    const scheduleKey = `league:${leagueId}:schedule`;
    
    console.log(`Clearing games for league ${leagueId}`);
    
    await Promise.all([
      kv.set(gamesKey, JSON.stringify([])),
      kv.set(scheduleKey, JSON.stringify([]))
    ]);
    
    console.log(`Cleared both ${gamesKey} and ${scheduleKey}`);
    
    return new Response(JSON.stringify({ 
      ok: true, 
      message: `Cleared all games for league ${leagueId}`,
      clearedKeys: [gamesKey, scheduleKey]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (e: any) {
    console.error('Clear games failed:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Failed to clear games' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
