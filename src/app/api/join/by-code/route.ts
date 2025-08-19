// POST join via code

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getMembership } from '@/lib/kv';
import { consumeCodeInvite } from '@/server/invites';
import { addPlayerToTeam } from '@/server/memberships';
import { ensurePaymentRecord } from '@/server/payments';

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')!;
  const { code } = await req.json();

  try {
    const existing = await getMembership(userId);
    if (existing) return NextResponse.json({ error: 'Already on a team' }, { status: 409 });

    const teamId = await consumeCodeInvite(code);
    const team = await addPlayerToTeam(userId, teamId);

    const amountCents = Number(process.env.FEE_PER_PLAYER_CENTS || 6500);
    const dueBy = process.env.SEASON_PAYMENT_DEADLINE || '2025-10-31';
    await ensurePaymentRecord(userId, team.id, amountCents, dueBy);

    return NextResponse.json({ ok: true, team: { id: team.id, name: team.name, divisionId: team.divisionId } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
