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
