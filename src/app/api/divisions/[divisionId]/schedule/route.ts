// GET division schedule (public)

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getDivisionSchedule } from '@/server/schedules';
import { isDivisionId } from '@/lib/divisions';

export async function GET(_req: NextRequest, { params }: { params: { divisionId: string } }) {
  if (!isDivisionId(params.divisionId)) return NextResponse.json({ error: 'Invalid division' }, { status: 400 });
  const schedule = await getDivisionSchedule(params.divisionId);
  return NextResponse.json({ schedule });
}
