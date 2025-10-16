// src/server/memberships.ts
import { kv } from "@vercel/kv";
import { DIVISIONS, type DivisionId } from "@/lib/divisions";
import type { Membership } from "@/lib/types";

function leagueNameFor(id: DivisionId): string {
  return DIVISIONS.find((d) => d.id === id)?.name ?? id;
}

// Helper to read array from KV (handles both array and stringified JSON)
async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}

export async function upsertMembership(userId: string, m: Membership) {
  const key = `user:${userId}:memberships`;
  const arr: Membership[] = await readArr<Membership>(key);
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
  const roster = await readArr<{ userId: string }>(`team:${teamId}:roster`);
  const leagueName = leagueNameFor(leagueId);

  await Promise.all(
    roster.map(async ({ userId }) => {
      const arr = await readArr<Membership>(`user:${userId}:memberships`);
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
  
  // Fetch user's display name
  const user = await kv.get<any>(`user:${userId}`);
  const displayName = user?.displayName || user?.email || userId;
  
  const now = new Date().toISOString();
  const roster = await readArr<any>(`team:${teamId}:roster`);
  
  // Add to roster with actual display name
  await kv.set(`team:${teamId}:roster`, [
    ...roster,
    { userId, displayName, isManager: false, joinedAt: now }
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

export async function removePlayerFromTeam(userId: string, teamId: string) {
  const team = await kv.get<any>(`team:${teamId}`);
  if (!team) throw new Error('Team not found');
  
  // Remove from roster
  const roster = await readArr<any>(`team:${teamId}:roster`);
  const newRoster = roster.filter(r => r.userId !== userId);
  await kv.set(`team:${teamId}:roster`, newRoster);
  
  // Remove from team payments
  const payKey = `team:${teamId}:payments`;
  const payMap = (await kv.get<Record<string, boolean>>(payKey)) || {};
  delete payMap[userId];
  await kv.set(payKey, payMap);
  
  // Remove membership - use readArr to handle both array and stringified JSON
  const membershipKey = `user:${userId}:memberships`;
  const memberships = await readArr<Membership>(membershipKey);
  const newMemberships = memberships.filter(m => m.teamId !== teamId);
  await kv.set(membershipKey, newMemberships);
  
  return { team, removedUser: userId };
}