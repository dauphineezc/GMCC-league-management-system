// src/app/leagues/[leagueId]/schedule/page.tsx
import { ScheduleList } from '@/components/scheduleList';

async function fetchGames(leagueId: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/leagues/${leagueId}/schedule`, { cache: 'no-store' });
  return (await res.json()) as any[];
}

export default async function LeagueSchedulePage({ params }: { params: { leagueId: string } }) {
  const games = await fetchGames(params.leagueId);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Schedule</h1>
      <ScheduleList games={games} />
    </div>
  );
}