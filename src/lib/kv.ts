// Thin helpers (get/set + common queries + hashing)

import { kv } from "@vercel/kv";

export async function getJSON<T>(key: string): Promise<T | null> {
  const v = await kv.get(key);
  return (v as T) ?? null;
}
export const setJSON = <T,>(key: string, value: T, opts?: { ex?: number }) => kv.set(key, value, opts);
export const del = (key: string) => kv.del(key);
export const incr = (key: string, ex?: number) => ex ? kv.incrbyex(key, 1, ex) : kv.incr(key);

// common queries
export const userMemberships = (userId: string) => getJSON<any[]>(`user:${userId}:memberships`);
export const team = (teamId: string) => getJSON<any>(`team:${teamId}`);
export const teamRoster = (teamId: string) => getJSON<any[]>(`team:${teamId}:roster`);
export const league = (leagueId: string) => getJSON<any>(`league:${leagueId}`);
export const leagueTeams = (leagueId: string) => getJSON<any[]>(`league:${leagueId}:teams`);