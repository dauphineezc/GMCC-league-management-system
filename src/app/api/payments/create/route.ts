// POST create checkout session (redirect URL)

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { createCheckoutFor } from '@/server/payments';

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')!;
  const { teamId } = await req.json();
  const membership = await kv.get<{ teamId: string; role: string }>(`user:${userId}:membership`);
  if (!membership || membership.teamId !== teamId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payment = await kv.get<any>(`user:${userId}:payment:${teamId}`);
  if (!payment) return NextResponse.json({ error: 'No payment record' }, { status: 404 });

  const redirectUrl = await createCheckoutFor(userId, teamId, payment.amountCents);
  return NextResponse.json({ redirectUrl });
}
