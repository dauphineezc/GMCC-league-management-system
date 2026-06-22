// GET division schedule (authenticated)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getDivisionSchedule } from '@/server/schedules';
import { isDivisionId } from '@/lib/divisions';
import { assertAuthenticated, isAuthFailure } from '@/lib/authGuards';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ divisionId: string }> }) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;

  const { divisionId } = await params;
  if (!isDivisionId(divisionId)) return NextResponse.json({ error: 'Invalid division' }, { status: 400 });
  const schedule = await getDivisionSchedule(divisionId);
  return NextResponse.json({ schedule });
}
