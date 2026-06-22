// src/app/api/team-names/route.ts
import { kv } from '@vercel/kv';
import { assertAuthenticated, isAuthFailure } from '@/lib/authGuards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;

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