// src/server/memberships.ts
import { kv } from "@vercel/kv";
import { DIVISIONS, type DivisionId } from "@/lib/divisions";
import type { Membership } from "@/lib/types";

function leagueNameFor(id: DivisionId): string {
  return DIVISIONS.find((d) => d.id === id)?.name ?? id;
}

export async function upsertMembership(userId: string, m: Membership) {
  const key = `user:${userId}:memberships`;
  const arr: Membership[] = (await kv.get<Membership[]>(key)) ?? [];
  const idx = arr.findIndex(x => x.teamId === m.teamId);
  if (idx >= 0) arr[idx] = { ...arr[idx], ...m };
  else arr.push(m);
  await kv.set(key, arr);
}

/**
 * Propagate team name / league changes to all members’ memberships.
 * Note leagueId is DivisionId (not string) to satisfy the union type.
 */
export async function updateMembershipNamesForTeam(
  teamId: string,
  teamName: string,
  leagueId: DivisionId
) {
  const roster = (await kv.get<{ userId: string }[]>(`team:${teamId}:roster`)) ?? [];
  const leagueName = leagueNameFor(leagueId);

  await Promise.all(
    roster.map(async ({ userId }) => {
      const arr = (await kv.get<Membership[]>(`user:${userId}:memberships`)) ?? [];
      const idx = arr.findIndex((x) => x.teamId === teamId);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], teamName, leagueId, leagueName };
        await kv.set(`user:${userId}:memberships`, arr);
      }
    })
  );
}

export async function addPlayerToTeam(userId: string, teamId: string) {
  const team = await kv.get<any>(`team:${teamId}`);
  if (!team) throw new Error('Team not found');
  
  const now = new Date().toISOString();
  const roster = (await kv.get<any[]>(`team:${teamId}:roster`)) ?? [];
  
  // Add to roster
  await kv.set(`team:${teamId}:roster`, [
    ...roster,
    { userId, displayName: "Player", isManager: false, joinedAt: now }
  ]);
  
  // Add membership
  await upsertMembership(userId, {
    teamId,
    leagueId: team.leagueId,
    isManager: false,
    teamName: team.name,
    leagueName: leagueNameFor(team.leagueId)
  });
  
  return team;
}