// src/app/leagues/[leagueId]/teams/[teamSlug]/page.tsx
import { ScheduleList } from '@/components/scheduleList';

async function fetchTeamGames(leagueId: string, teamName: string) {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/leagues/${leagueId}/schedule?team=${encodeURIComponent(teamName)}`;
  const res = await fetch(url, { cache: 'no-store' });
  return (await res.json()) as any[];
}

export default async function TeamPage({ params }: { params: { leagueId: string; teamSlug: string } }) {
  // however you resolve slug -> teamName
  const teamName = decodeURIComponent(params.teamSlug).replace(/-/g, ' ');
  const games = await fetchTeamGames(params.leagueId, teamName);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{teamName} • Schedule</h1>
      <ScheduleList games={games} />
    </div>
  );
}