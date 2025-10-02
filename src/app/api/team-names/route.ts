// src/app/api/team-names/route.ts
import { kv } from '@vercel/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const leagueId = url.searchParams.get('leagueId') || '';
    const global = (await kv.smembers('teams:names')) || [];
    const league = leagueId ? (await kv.smembers(`league:${leagueId}:teamNames`)) || [] : [];
    const unique = Array.from(new Set([...global, ...league])).sort();
    return new Response(JSON.stringify(unique), { status: 200 });
  } catch {
    return new Response(JSON.stringify([]), { status: 200 });
  }
}