// src/app/api/leagues/[leagueId]/standings/calculate/route.ts
import { kv } from '@vercel/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StandingRow = {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  winPercentage: number;
  gamesPlayed: number;
};

function parseKV(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.trim() ? JSON.parse(raw) : [];
  return [];
}

export async function POST(req: Request, { params }: { params: { leagueId: string } }) {
  try {
    const { leagueId } = params;
    console.log(`Calculating standings for league ${leagueId}`);

    // Get all team IDs in the league (stored as a SET)
    const teamIds = (await kv.smembers(`league:${leagueId}:teams`)) as string[] || [];
    console.log(`Found ${teamIds.length} team IDs`);

    // Fetch team data for each team ID
    const teams = await Promise.all(
      teamIds.map(async (teamId) => {
        const teamData = await kv.get(`team:${teamId}`);
        if (typeof teamData === 'string') {
          const parsed = JSON.parse(teamData);
          return { teamId, name: parsed.name || teamId, ...parsed };
        }
        if (teamData && typeof teamData === 'object') {
          return { teamId, name: (teamData as any).name || teamId, ...teamData };
        }
        return { teamId, name: teamId };
      })
    );
    console.log(`Found ${teams.length} teams`);

    // Get all games with final results
    const gamesKey = `league:${leagueId}:games`;
    let rawGames = await kv.get(gamesKey);
    if (!rawGames && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(gamesKey)}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body?.result) {
        rawGames = body.result;
      }
    }

    const games = parseKV(rawGames);
    console.log(`Found ${games.length} total games`);

    // Filter games with final results (scores entered)
    const finalGames = games.filter(game => {
      const status = (game.status || '').toLowerCase();
      return (status === 'final' || status === 'completed') && 
             game.homeScore != null && 
             game.awayScore != null;
    });
    console.log(`Found ${finalGames.length} games with final scores`);

    // Initialize standings for all teams
    const standings: Map<string, StandingRow> = new Map();
    
    // Add all teams from league teams list to standings with zero stats
    teams.forEach(team => {
      standings.set(team.name, {
        teamId: team.teamId || team.id,
        teamName: team.name,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        winPercentage: 0,
        gamesPlayed: 0
      });
    });

    // Also add any team names from games that aren't in the teams list
    const allTeamNamesInGames = new Set<string>();
    games.forEach(game => {
      if (game.homeTeamName) allTeamNamesInGames.add(game.homeTeamName);
      if (game.awayTeamName) allTeamNamesInGames.add(game.awayTeamName);
    });

    allTeamNamesInGames.forEach(teamName => {
      if (!standings.has(teamName)) {
        standings.set(teamName, {
          teamId: teamName.toLowerCase().replace(/\s+/g, '-'),
          teamName: teamName,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          winPercentage: 0,
          gamesPlayed: 0
        });
      }
    });

    // Calculate stats from games
    finalGames.forEach(game => {
      const homeTeam = game.homeTeamName;
      const awayTeam = game.awayTeamName;
      const homeScore = parseInt(game.homeScore);
      const awayScore = parseInt(game.awayScore);

      // Skip if invalid scores
      if (isNaN(homeScore) || isNaN(awayScore)) {
        console.log(`Skipping game with invalid scores: ${homeTeam} vs ${awayTeam} (${homeScore}-${awayScore})`);
        return;
      }

      // Skip if we don't have both teams in standings (shouldn't happen now)
      if (!standings.has(homeTeam) || !standings.has(awayTeam)) {
        console.log(`Skipping game with missing teams: ${homeTeam} vs ${awayTeam}`);
        return;
      }

      const homeStanding = standings.get(homeTeam)!;
      const awayStanding = standings.get(awayTeam)!;

      // Update points
      homeStanding.pointsFor += homeScore;
      homeStanding.pointsAgainst += awayScore;
      awayStanding.pointsFor += awayScore;
      awayStanding.pointsAgainst += homeScore;

      // Update games played
      homeStanding.gamesPlayed++;
      awayStanding.gamesPlayed++;

      // Update wins/losses
      if (homeScore > awayScore) {
        homeStanding.wins++;
        awayStanding.losses++;
      } else if (awayScore > homeScore) {
        awayStanding.wins++;
        homeStanding.losses++;
      }
      // Note: ties don't count as wins or losses

      console.log(`Updated: ${homeTeam} (${homeScore}) vs ${awayTeam} (${awayScore})`);
    });

    // Calculate win percentages
    standings.forEach(standing => {
      const totalGames = standing.wins + standing.losses;
      standing.winPercentage = totalGames > 0 ? standing.wins / totalGames : 0;
    });

    // --- Tie-break helpers ---

    // Only considers games that involved both teams and were final
    function headToHead(aTeamName: string, bTeamName: string): number {
      let aWins = 0, bWins = 0;
      for (const g of finalGames) {
        const involvesA = g.homeTeamName === aTeamName || g.awayTeamName === aTeamName;
        const involvesB = g.homeTeamName === bTeamName || g.awayTeamName === bTeamName;
        if (!involvesA || !involvesB) continue;

        const aScore =
          g.homeTeamName === aTeamName ? parseInt(g.homeScore) : parseInt(g.awayScore);
        const bScore =
          g.homeTeamName === bTeamName ? parseInt(g.homeScore) : parseInt(g.awayScore);

        if (!Number.isFinite(aScore) || !Number.isFinite(bScore)) continue;

        if (aScore > bScore) aWins++;
        else if (bScore > aScore) bWins++;
      }

      // Return <0 if a should come before b, >0 if b before a, 0 if no decision
      if (aWins !== bWins) return bWins - aWins; // b ahead if b has more H2H wins
      return 0;
    }

    // Sort standings:
    // 1) Teams with games played, sorted by:
    //    win% (desc) → losses (asc) → head-to-head → point diff (desc) →
    //    points against (asc) → points for (desc) → name (asc)
    // 2) Teams with no games played, sorted alphabetically
    const standingsArray = Array.from(standings.values());

    const teamsWithGames = standingsArray.filter(team => team.gamesPlayed > 0);
    const teamsWithoutGames = standingsArray.filter(team => team.gamesPlayed === 0);

    teamsWithGames.sort((a, b) => {
      // 1) win percentage (descending)
      if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;

      // 2) fewest losses (ascending)
      if (a.losses !== b.losses) return a.losses - b.losses;

      // 3) head-to-head (only between these two)
      const h2h = headToHead(a.teamName, b.teamName);
      if (h2h !== 0) return h2h;

      // 4) point differential (descending)
      const aDiff = a.pointsFor - a.pointsAgainst;
      const bDiff = b.pointsFor - b.pointsAgainst;
      if (bDiff !== aDiff) return bDiff - aDiff;

      // 5) points against (ascending)
      if (a.pointsAgainst !== b.pointsAgainst) return a.pointsAgainst - b.pointsAgainst;

      // 6) points for (descending)
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;

      // 7) stable fallback
      return a.teamName.localeCompare(b.teamName);
    });

    teamsWithoutGames.sort((a, b) => a.teamName.localeCompare(b.teamName));

    // Combine: teams with games first, then teams without games
    const sortedStandings = [...teamsWithGames, ...teamsWithoutGames];

    // Save standings (unchanged)
    const standingsKey = `league:${leagueId}:standings`;
    const standingsData = JSON.stringify(sortedStandings);
    const backupKey = `${standingsKey}:backup`;

    await Promise.all([
      kv.set(standingsKey, standingsData),
      kv.set(backupKey, standingsData),
    ]);


    console.log(`Saved standings for ${sortedStandings.length} teams`);
    console.log('Top 3 teams:', sortedStandings.slice(0, 3).map(t => 
      `${t.teamName}: ${t.wins}-${t.losses} (${(t.winPercentage * 100).toFixed(1)}%), ${t.pointsFor} PF`
    ));

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
