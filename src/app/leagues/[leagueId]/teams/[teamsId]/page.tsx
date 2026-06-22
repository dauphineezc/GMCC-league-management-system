// src/app/leagues/[leagueId]/teams/[teamSlug]/page.tsx
import { ScheduleList } from '@/components/scheduleList';
import { getLeagueScheduleView } from '@/lib/leagueData';

async function fetchTeamGames(leagueId: string, teamName: string): Promise<any[]> {
  try {
    return await getLeagueScheduleView(leagueId, teamName);
  } catch {
    return [];
  }
}

export default async function TeamPage({ params }: { params: { leagueId: string; teamSlug: string } }) {
  // however you resolve slug -> teamName
  const teamName = decodeURIComponent(params.teamSlug).replace(/-/g, ' ');
  const games = await fetchTeamGames(params.leagueId, teamName);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{teamName} • Schedule</h1>
      <ScheduleList games={games as any} />
    </div>
  );
}