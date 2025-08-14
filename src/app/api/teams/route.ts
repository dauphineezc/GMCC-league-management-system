// POST create team

import { NextRequest, NextResponse } from 'next/server';
import { assertUserNotOnTeam, createTeamForUser } from '@/server/memberships';
import { isDivisionId } from '@/lib/divisions';

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')!;
  const { name, divisionId } = await req.json();

  if (!name || typeof name !== 'string' || !isDivisionId(divisionId)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  try {
    await assertUserNotOnTeam(userId);
    const team = await createTeamForUser(userId, name.trim(), divisionId);
    return NextResponse.json({ team, inviteOptions: { createLinkAt: '/api/invites', createCodeAt: '/api/invites' } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
