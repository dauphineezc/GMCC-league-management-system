// POST create invite (link/code)

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { ensureLead } from '@/server/invites';
import { getTeamMembers } from '@/lib/kv';
import { createLinkInvite, createCodeInvite } from '@/server/invites';

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')!;
  const { teamId, kind } = await req.json();

  if (!teamId || !['link', 'code'].includes(kind)) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }

  try {
    const team = await ensureLead(userId, teamId);
    const members = await getTeamMembers(teamId);
    if (members.length >= (team.rosterLimit ?? 8)) {
      return NextResponse.json({ error: 'Roster full' }, { status: 409 });
    }

    if (kind === 'link') {
      const { token } = await createLinkInvite(teamId);
      const base = process.env.APP_BASE_URL || 'http://localhost:3000';
      return NextResponse.json({ inviteUrl: `${base}/join?t=${token}` });
    } else {
      const { code } = await createCodeInvite(teamId);
      return NextResponse.json({ code });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
