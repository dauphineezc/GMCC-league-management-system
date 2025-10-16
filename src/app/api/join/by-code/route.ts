// POST join via code

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getServerUser } from '@/lib/serverUser';
import { consumeCodeInvite } from '@/server/invites';
import { addPlayerToTeam } from '@/server/memberships';

async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to join a team' }, { status: 401 });
  }

  const { code } = await req.json();

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  try {
    const teamId = await consumeCodeInvite(code);
    const team = await kv.get<any>(`team:${teamId}`);
    
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const leagueId = team.leagueId || 'unknown';

    // Check if user is already on a team in this league
    const memberships = await readArr<any>(`user:${user.id}:memberships`);
    if (memberships.some((m) => m.leagueId === leagueId)) {
      return NextResponse.json({ error: 'Already on a team' }, { status: 409 });
    }

    // Check if team is full
    const roster = await readArr<any>(`team:${teamId}:roster`);
    const rosterLimit = team.rosterLimit ?? 8;
    if (roster.length >= rosterLimit) {
      return NextResponse.json({ error: 'Team is full' }, { status: 400 });
    }

    // Add player to team
    await addPlayerToTeam(user.id, teamId);

    // Set up payment record
    const payKey = `team:${teamId}:payments`;
    const payMap = (await kv.get<Record<string, boolean>>(payKey)) || {};
    payMap[user.id] = false; // mark unpaid on join
    await kv.set(payKey, payMap);

    return NextResponse.json({ 
      ok: true, 
      team: { 
        id: team.id, 
        name: team.name, 
        leagueId: team.leagueId 
      } 
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
