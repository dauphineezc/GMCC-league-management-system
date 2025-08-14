// Read/write schedule helpers (KV key shapes)

import { kv } from '@/lib/kv';
import type { DivisionId, Game } from '@/lib/types';

export async function getDivisionSchedule(divisionId: DivisionId) {
  return (await kv.get<Game[]>(`division:${divisionId}:schedule`)) ?? [];
}

export async function getTeamScheduleDenorm(teamId: string) {
  return (await kv.get<Game[]>(`game:${teamId}`)) ?? [];
}
