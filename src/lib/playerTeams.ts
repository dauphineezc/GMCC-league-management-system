// src/lib/playerTeams.ts
import { kv } from "@vercel/kv";
import type { PlayerTeam } from "@/types/domain";

type Membership = {
  teamId: string;
  teamName?: string | null;
  leagueId?: string | null;
  leagueName?: string | null;
  isManager?: boolean;
};

// tolerant GET for JSON array
async function readMemberships(uid: string): Promise<Membership[]> {
  try {
    const raw = (await kv.get(`user:${uid}:memberships`)) as unknown;
    if (Array.isArray(raw)) return raw as Membership[];
    if (typeof raw === "string") {
      const s = raw.trim();
      if (!s) return [];
      try { const arr = JSON.parse(s); return Array.isArray(arr) ? (arr as Membership[]) : []; } catch {}
    }
  } catch {}
  return [];
}

export async function getTeamsForUserFromMemberships(uid: string): Promise<PlayerTeam[]> {
  const mems = await readMemberships(uid);

  // optional: enrich "paid" from per-team payment map
  const result: PlayerTeam[] = [];
  for (const m of mems) {
    const payMap = (await kv.get<Record<string, boolean>>(`team:${m.teamId}:payments`).catch(() => null)) || null;
    result.push({
      teamId: m.teamId,
      teamName: (m.teamName ?? m.teamId) || m.teamId,
      isManager: !!m.isManager,
      paid: Boolean(payMap?.[uid]),
      // normalize null -> undefined to satisfy PlayerTeam
      leagueId: m.leagueId ?? undefined,
      leagueName: m.leagueName ?? undefined,
    });
  }
  return result;
}

export async function buildPlayerTeamsByUserFromMemberships(
  userIds: string[]
): Promise<Record<string, PlayerTeam[]>> {
  const uniq = Array.from(new Set(userIds));
  const entries = await Promise.all(
    uniq.map(async (uid) => [uid, await getTeamsForUserFromMemberships(uid)] as const)
  );
  return Object.fromEntries(entries);
}