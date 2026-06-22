// src/app/api/leagues/[leagueId]/standings/calculate/route.ts
import { assertCronOrSuperAdminOrLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { calculateAndSaveStandings } from "@/lib/leagueData";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  try {
    const { leagueId } = await params;

    const auth = await assertCronOrSuperAdminOrLeagueAdmin(req, leagueId);
    if (isAuthFailure(auth)) return auth.response;

    const sortedStandings = await calculateAndSaveStandings(leagueId);

    return new Response(JSON.stringify({
      ok: true,
      standings: sortedStandings,
      message: `Standings calculated for ${sortedStandings.length} teams`
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Error calculating standings:', e);
    return new Response(JSON.stringify({
      error: e?.message || 'Failed to calculate standings'
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
