// Join/create checks, one-team rule, roster cap

import { kv, getMembership, getTeamMembers, setMembership, setTeamMembers, now } from '@/lib/kv';
import { DEFAULT_ROSTER_LIMIT } from '@/lib/divisions';
import type { MemberPublic, Team } from '@/lib/types';

export async function assertUserNotOnTeam(userId: string) {
  const m = await getMembership(userId);
  if (m) throw Object.assign(new Error('User already on a team'), { status: 409 });
}

export async function createTeamForUser(userId: string, name: string, divisionId: string) {
  const teamId = crypto.randomUUID();
  const team: Team = {
    id: teamId,
    name,
    divisionId: divisionId as any,
    leadUserId: userId,
    createdAt: now(),
    rosterLimit: DEFAULT_ROSTER_LIMIT,
  };
  const lead: MemberPublic = { userId, name: 'Team Lead', role: 'LEAD', joinedAt: now() };
  await Promise.all([
    kv.set(`team:${teamId}`, team),
    kv.set(`team:${teamId}:members`, [lead]),
    kv.set(`user:${userId}:membership`, { teamId, role: 'LEAD' }),
  ]);
  return team;
}

export async function addPlayerToTeam(userId: string, teamId: string) {
  const team = await kv.get<Team>(`team:${teamId}`);
  if (!team) throw Object.assign(new Error('Team not found'), { status: 404 });

  const members = await getTeamMembers(teamId);
  const limit = team.rosterLimit ?? DEFAULT_ROSTER_LIMIT;
  if (members.length >= limit) throw Object.assign(new Error('Roster full'), { status: 409 });

  const updated = [...members, { userId, name: 'Player', role: 'PLAYER' as const, joinedAt: now() }];
  await setTeamMembers(teamId, updated);
  await setMembership(userId, { teamId, role: 'PLAYER' });
  return team;
}
