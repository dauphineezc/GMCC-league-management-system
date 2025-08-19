export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { kv, getMembership } from '@/lib/kv';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')!;
  const profile = (await kv.get(`user:${userId}`)) ?? { id: userId, createdAt: new Date().toISOString() };
  const membership = await getMembership(userId);

  let team = null, payment = null, nextGames: any[] = [];
  if (membership?.teamId) {
    const teamObj = await kv.get<any>(`team:${membership.teamId}`);
    const schedule = (await kv.get<any[]>(`game:${membership.teamId}`)) ?? [];
    team = { id: teamObj?.id, name: teamObj?.name, divisionId: teamObj?.divisionId, role: membership.role };
    payment = await kv.get<any>(`user:${userId}:payment:${membership.teamId}`);
    nextGames = schedule.filter(g => g.status === 'SCHEDULED').slice(0, 5);
  }
  return NextResponse.json({ profile, membership, team, payment, nextGames });
}
