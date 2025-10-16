// Read/write schedule helpers (KV key shapes)

import { kv } from '@vercel/kv';
import type { DivisionId } from '@/lib/divisions';
import type { Game } from '@/types/domain';

export async function getDivisionSchedule(divisionId: DivisionId) {
  return (await kv.get<Game[]>(`division:${divisionId}:schedule`)) ?? [];
}

export async function getTeamScheduleDenorm(teamId: string) {
  return (await kv.get<Game[]>(`game:${teamId}`)) ?? [];
}
