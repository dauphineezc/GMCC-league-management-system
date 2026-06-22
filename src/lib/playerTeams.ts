// src/lib/playerTeams.ts
import type { PlayerTeam } from "@/types/domain";
import { batchGetPayments } from "@/lib/kvBatch";
import { readMembershipsForUid, readMembershipsForUids } from "@/lib/repositories/usersRepo";

export async function getTeamsForUserFromMemberships(uid: string): Promise<PlayerTeam[]> {
  const mems = await readMembershipsForUid(uid);
  if (!mems.length) return [];

  const teamIds = mems.map((m) => m.teamId);
  const payments = await batchGetPayments(teamIds);

  return mems.map((m) => {
    const payMap = payments.get(m.teamId) ?? {};
    return {
      teamId: m.teamId,
      teamName: (m.teamName ?? m.teamId) || m.teamId,
      isManager: !!m.isManager,
      paid: Boolean(payMap[uid]),
      leagueId: m.leagueId ?? undefined,
      leagueName: m.leagueName ?? undefined,
    };
  });
}

export async function buildPlayerTeamsByUserFromMemberships(
  userIds: string[]
): Promise<Record<string, PlayerTeam[]>> {
  const byUser = await readMembershipsForUids(userIds);
  const allTeamIds = Array.from(
    new Set(Array.from(byUser.values()).flatMap((mems) => mems.map((m) => m.teamId)))
  );
  const payments = allTeamIds.length ? await batchGetPayments(allTeamIds) : new Map();

  const out: Record<string, PlayerTeam[]> = {};
  for (const uid of userIds) {
    const mems = byUser.get(uid) ?? [];
    out[uid] = mems.map((m) => {
      const payMap = payments.get(m.teamId) ?? {};
      return {
        teamId: m.teamId,
        teamName: (m.teamName ?? m.teamId) || m.teamId,
        isManager: !!m.isManager,
        paid: Boolean(payMap[uid]),
        leagueId: m.leagueId ?? undefined,
        leagueName: m.leagueName ?? undefined,
      };
    });
  }
  return out;
}
