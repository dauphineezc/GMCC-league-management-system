import {
  batchGetPayments,
  batchGetRosters,
  batchGetTeamDocs,
  batchGetTeamNames,
} from "@/lib/repositories/teamsRepo";
import { listGamesForTeams, gameRowToLegacy } from "@/lib/repositories/gamesRepo";

export { batchGetTeamNames, batchGetPayments, batchGetRosters };

export async function batchGet<T = any>(keys: string[]): Promise<Map<string, T | null>> {
  const result = new Map<string, T | null>();
  if (!keys.length) return result;

  const teamIds = keys
    .filter((k) => k.startsWith("team:") && !k.includes(":", 5))
    .map((k) => k.slice("team:".length));

  if (teamIds.length) {
    const docs = await batchGetTeamDocs(teamIds);
    for (const key of keys) {
      if (key.startsWith("team:") && !key.includes(":", 5)) {
        result.set(key, (docs.get(key) ?? null) as T | null);
      }
    }
  }

  for (const key of keys) {
    if (result.has(key)) continue;
    result.set(key, null);
  }
  return result;
}

export const batchGetTeams = batchGetTeamDocs;

export async function batchGetGames(teamIds: string[]): Promise<Map<string, any[]>> {
  const map = new Map<string, any[]>();
  if (!teamIds.length) return map;

  const byTeam = await listGamesForTeams(teamIds);
  for (const teamId of teamIds) {
    const rows = byTeam.get(teamId) ?? [];
    const legacy = rows.map((g) => gameRowToLegacy(g, ""));
    map.set(teamId, legacy);
    map.set(`team:${teamId}:games`, legacy);
  }
  return map;
}

export function parseArrayFromKV<T = any>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? (arr as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
