// src/app/api/leagues/[leagueId]/standings/route.ts
import { assertAuthenticated, isAuthFailure } from '@/lib/authGuards';
import { getOrCalculateStandings } from '@/lib/leagueData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;

  try {
    const { leagueId } = await params;

    // Direct KV read; calculate + persist in-process on cache miss (no HTTP hop)
    const standings = await getOrCalculateStandings(leagueId);

    return new Response(JSON.stringify(standings), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store'
      }
    });

  } catch (e: any) {
    console.error('Error fetching standings:', e);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
}