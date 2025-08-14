// GET team schedule (member-only)

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

export async function GET(req: NextRequest, { params }: { params: { teamId: string } }) {
  const userId = req.headers.get('x-user-id')!;
  const membership = await kv.get<{ teamId: string }>(`user:${userId}:membership`);
  if (!membership || membership.teamId !== params.teamId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const schedule = (await kv.get<any[]>(`game:${params.teamId}`)) ?? [];
  return NextResponse.json({ schedule });
}
