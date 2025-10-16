// src/lib/leagueDoc.ts
import { kv } from "@vercel/kv";

export type LeagueDoc = {
    id?: string;
    name?: string;
    description?: string;
    adminUserId: string | null;   // <- always present
    createdAt?: number | string;
    updatedAt?: number;
    sport?: string;
    gender?: string;
    division?: string;
    team_size?: string;
    [k: string]: any;
};

export async function readLeagueDocJSON(leagueId: string): Promise<LeagueDoc | null> {
    const raw = await kv.get(`league:${leagueId}`);
    if (!raw) return null;
    if (typeof raw === "string") return JSON.parse(raw) as LeagueDoc;
    return raw as LeagueDoc; // Upstash will also return parsed objects sometimes
  }
  
  export async function writeLeagueAdminJSON(leagueId: string, adminUserId: string | null) {
    const key = `league:${leagueId}`;
    const existing = (await readLeagueDocJSON(leagueId)) ?? ({ id: leagueId } as LeagueDoc);
  
    const merged: LeagueDoc = {
      ...existing,
      adminUserId,       // always keep the field, can be null
      updatedAt: Date.now(),
    };
  
    await kv.set(key, merged); // store as JSON string in Upstash
    return merged;
  }

// Upsert only adminUserId (+ updatedAt). Works with either hash or plain object.
export async function writeLeagueAdmin(leagueId: string, adminUserId: string | null): Promise<void> {
  const key = `league:${leagueId}`;
  const updatedAt = Date.now();

  // First try hash write
  try {
    if (adminUserId === null) {
      // prefer removing the field for "unassigned"
      await kv.hdel(key, "adminUserId");
      await kv.hset(key, { updatedAt }); // ensure timestamp updates
    } else {
      await kv.hset(key, { adminUserId, updatedAt });
    }
    return;
  } catch (err: any) {
    // If the failure is WRONGTYPE, fall through to object merge
    const msg = String(err?.message || err);
    const wrongType = msg.includes("WRONGTYPE");
    if (!wrongType) throw err;
  }

  // Not a hash → do read/merge/set
  const existing = (await readLeagueDocJSON(leagueId)) ?? {};
  const merged: LeagueDoc = { ...existing, updatedAt, adminUserId: null };
  if (adminUserId === null) {
    // remove key for "unassigned"
    merged.adminUserId = null;
  } else {  
    merged.adminUserId = adminUserId;
  }

  await kv.set(key, merged);
}