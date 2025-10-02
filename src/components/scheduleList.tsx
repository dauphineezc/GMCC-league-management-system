// src/components/ScheduleList.tsx
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
import type { Game } from '@/types/domain';
dayjs.extend(utc); dayjs.extend(tz);

export function ScheduleList({ games, timezone = 'America/Detroit' }:{ games: Game[]; timezone?: string }) {
  if (!games.length) return <p className="text-sm text-gray-500">No games scheduled.</p>;
  return (
    <div className="divide-y rounded-2xl border shadow-sm overflow-hidden">
      {games.map(g => {
        const local = dayjs(g.dateTimeISO).tz(timezone);
        return (
          <div key={g.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3">
            <div className="font-medium">{g.homeTeamName} <span className="text-gray-400">vs</span> {g.awayTeamName}</div>
            <div className="text-sm tabular-nums">{local.format('ddd, MMM D')}</div>
            <div className="text-sm tabular-nums">{local.format('h:mm A')}</div>
            <div className="text-sm">{g.location}</div>
          </div>
        );
      })}
    </div>
  );
}