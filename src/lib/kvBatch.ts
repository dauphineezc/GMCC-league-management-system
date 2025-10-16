// Batch KV operations for performance optimization
import { kv } from "@vercel/kv";

/**
 * Batch fetch multiple keys in parallel using MGET (much faster than individual gets)
 * 
 * Example:
 *   const teams = await batchGet(['team:1', 'team:2', 'team:3']);
 *   // Returns: Map { 'team:1' => {...}, 'team:2' => {...}, 'team:3' => {...} }
 */
export async function batchGet<T = any>(keys: string[]): Promise<Map<string, T | null>> {
  if (keys.length === 0) return new Map();
  
  // Use MGET for efficient batch retrieval
  const values = await kv.mget<T>(...keys);
  
  const result = new Map<string, T | null>();
  keys.forEach((key, index) => {
    result.set(key, values[index]);
  });
  
  return result;
}

/**
 * Batch fetch teams by IDs
 */
export async function batchGetTeams(teamIds: string[]) {
  if (teamIds.length === 0) return new Map();
  
  const keys = teamIds.map(id => `team:${id}`);
  return batchGet<any>(keys);
}

/**
 * Batch fetch team names - optimized helper
 */
export async function batchGetTeamNames(teamIds: string[]): Promise<Map<string, string>> {
  if (teamIds.length === 0) return new Map();
  
  const teams = await batchGetTeams(teamIds);
  const nameMap = new Map<string, string>();
  
  teamIds.forEach(id => {
    const team = teams.get(`team:${id}`);
    if (team?.name) {
      nameMap.set(id, team.name);
    }
  });
  
  return nameMap;
}

/**
 * Batch fetch payment maps for multiple teams
 */
export async function batchGetPayments(teamIds: string[]): Promise<Map<string, Record<string, boolean>>> {
  if (teamIds.length === 0) return new Map();
  
  const keys = teamIds.map(id => `team:${id}:payments`);
  const results = await batchGet<Record<string, boolean>>(keys);
  
  const paymentMap = new Map<string, Record<string, boolean>>();
  teamIds.forEach(id => {
    const payments = results.get(`team:${id}:payments`) ?? {};
    paymentMap.set(id, payments);
  });
  
  return paymentMap;
}

/**
 * Batch fetch rosters for multiple teams
 */
export async function batchGetRosters(teamIds: string[]): Promise<Map<string, any[]>> {
  if (teamIds.length === 0) return new Map();
  
  const keys = teamIds.map(id => `team:${id}:roster`);
  const results = await batchGet<any>(keys);
  
  const rosterMap = new Map<string, any[]>();
  teamIds.forEach(id => {
    const roster = results.get(`team:${id}:roster`);
    const rosterArray = Array.isArray(roster) 
      ? roster 
      : (typeof roster === 'string' ? JSON.parse(roster || '[]') : []);
    rosterMap.set(id, rosterArray);
  });
  
  return rosterMap;
}

/**
 * Batch fetch games for multiple teams
 */
export async function batchGetGames(teamIds: string[]): Promise<Map<string, any[]>> {
  if (teamIds.length === 0) return new Map();
  
  const keys = teamIds.map(id => `team:${id}:games`);
  const results = await batchGet<any>(keys);
  
  const gamesMap = new Map<string, any[]>();
  teamIds.forEach(id => {
    const games = results.get(`team:${id}:games`);
    const gamesArray = Array.isArray(games)
      ? games
      : (typeof games === 'string' ? JSON.parse(games || '[]') : []);
    gamesMap.set(id, gamesArray);
  });
  
  return gamesMap;
}

/**
 * Helper to parse array from KV (handles string JSON or native arrays)
 */
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

