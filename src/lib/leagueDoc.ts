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
    minTeamSize?: number;             // minimum number of paid players required
    maxTeamSize?: number;             // maximum roster size allowed
    playerAddDeadline?: string;       // ISO date string - when set, managers can't add players after this date
    playerAddDeadlineOverride?: boolean; // if true, allows adding players even after deadline (for special circumstances)
    [k: string]: any;
};

export async function readLeagueDocJSON(leagueId: string): Promise<LeagueDoc | null> {
    // Try reading as hash first (for leagues created with writePatch)
    try {
      const h = (await kv.hgetall(`league:${leagueId}`)) as Record<string, any> | null;
      if (h && typeof h === "object" && Object.keys(h).length) {
        // Convert hash to LeagueDoc format
        return {
          id: h.id ?? leagueId,
          name: h.name,
          description: h.description,
          adminUserId: h.adminUserId ?? null,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
          sport: h.sport,
          gender: h.gender,
          division: h.division,
          team_size: h.team_size,
          minTeamSize: h.minTeamSize,
          maxTeamSize: h.maxTeamSize,
          playerAddDeadline: h.playerAddDeadline,
          playerAddDeadlineOverride: h.playerAddDeadlineOverride,
          ...h,
        } as LeagueDoc;
      }
    } catch {}
    
    // Fall back to JSON/object format
    try {
      const raw = await kv.get(`league:${leagueId}`);
      if (!raw) return null;
      if (typeof raw === "string") return JSON.parse(raw) as LeagueDoc;
      if (typeof raw === "object") return raw as LeagueDoc;
    } catch {}
    
    return null;
  }
  
  export async function writeLeagueAdminJSON(leagueId: string, adminUserId: string | null) {
    const key = `league:${leagueId}`;
    const existing = (await readLeagueDocJSON(leagueId)) ?? ({ id: leagueId } as LeagueDoc);
  
    const merged: LeagueDoc = {
      ...existing,
      adminUserId,       // always keep the field, can be null
      updatedAt: Date.now(),
    };
  
    // Try writing as hash first (if league was created with writePatch)
    try {
      if (adminUserId === null) {
        await kv.hdel(key, "adminUserId");
        await kv.hset(key, { updatedAt: merged.updatedAt } as any);
      } else {
        await kv.hset(key, { adminUserId, updatedAt: merged.updatedAt } as any);
      }
      return merged;
    } catch (err: any) {
      // If the failure is WRONGTYPE, fall through to JSON write
      const msg = String(err?.message || err);
      const wrongType = msg.includes("WRONGTYPE");
      if (!wrongType) throw err;
    }
  
    // Fall back to JSON format
    await kv.set(key, merged);
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