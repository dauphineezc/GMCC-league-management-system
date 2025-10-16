import { kv } from "@vercel/kv";

/** tiny safe JSON parse */
function tryJson<T = any>(v: unknown): T | null {
  try {
    if (typeof v === "string") return JSON.parse(v) as T;
  } catch {}
  return null;
}

function coerceMembership(v: any) {
  if (!v) return null;

  // If raw string, try JSON; if not JSON, treat as bare team id
  if (typeof v === "string") {
    const parsed = tryJson<any>(v);
    if (parsed && typeof parsed === "object") v = parsed;
    else return { teamId: v, leagueId: null, isManager: false } as const;
  }

  if (typeof v !== "object") return null;

  const teamId    = String((v as any).teamId ?? (v as any).id ?? "").trim();
  const leagueId  = String((v as any).leagueId ?? (v as any).division ?? "").trim() || null;
  const isManager = Boolean((v as any).isManager ?? (v as any).manager ?? (v as any).captain ?? false);

  if (!teamId) return null;

  return {
    teamId,
    leagueId,
    isManager,
    teamName: (v as any).teamName ?? null,
    leagueName: (v as any).leagueName ?? null,
  };
}

function dedupe<T extends { teamId: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const m of arr) {
    if (!seen.has(m.teamId)) {
      seen.add(m.teamId);
      out.push(m);
    }
  }
  return out;
}

/**
 * Read memberships in a tolerant way. Supports:
 * - GET user:<uid>:memberships as JSON string OR array/object  (v2 preferred)
 * - SMEMBERS user:<uid>:memberships (array of JSON strings or teamIds)
 * - HGETALL user:<uid> with field "memberships" as JSON string OR array (legacy)
 * - legacy by email (same shapes as above; promoted to v2)
 */
export async function readMembershipsForUid(
  uid: string,
  email?: string | null
): Promise<Array<{ teamId: string; leagueId: string | null; isManager: boolean; teamName?: string | null; leagueName?: string | null }>> {
  if (!uid) return [];

  // ---- 1) Preferred v2: GET user:{uid}:memberships ----
  {
    const raw = await kv.get(`user:${uid}:memberships`).catch(() => null);

    // native array
    if (Array.isArray(raw)) {
      const out = (raw as any[]).map(coerceMembership).filter(Boolean) as any[];
      if (out.length) return dedupe(out);
    }

    // object that contains memberships or is array-like object
    if (raw && typeof raw === "object") {
      const arr = (raw as any).memberships;
      if (Array.isArray(arr)) {
        const out = arr.map(coerceMembership).filter(Boolean) as any[];
        if (out.length) return dedupe(out);
      }
      const asArr = Array.isArray(raw) ? (raw as any[]) : tryJson<any[]>(raw as any);
      if (Array.isArray(asArr) && asArr.length) {
        const out = asArr.map(coerceMembership).filter(Boolean) as any[];
        if (out.length) return dedupe(out);
      }
    }

    // JSON string
    if (typeof raw === "string") {
      const arr = tryJson<any[]>(raw);
      if (Array.isArray(arr) && arr.length) {
        const out = arr.map(coerceMembership).filter(Boolean) as any[];
        if (out.length) return dedupe(out);
      }
    }
  }

  // ---- 2) Set-based legacy: SMEMBERS user:{uid}:memberships ----
  {
    const setVals = (await kv.smembers(`user:${uid}:memberships`).catch(() => null)) as unknown;
    if (Array.isArray(setVals) && setVals.length) {
      const out = (setVals as any[]).map(coerceMembership).filter(Boolean) as any[];
      if (out.length) return dedupe(out);
    }
  }

  // ---- 3) Legacy hash: HGETALL user:{uid} with "memberships" field ----
  {
    try {
      const hash = (await kv.hgetall(`user:${uid}`)) as Record<string, unknown> | null;
      if (hash && typeof hash === "object" && "memberships" in hash) {
        const hv = (hash as any).memberships;
        let arr: any[] | null = null;
        if (Array.isArray(hv)) arr = hv;
        else if (typeof hv === "string") arr = tryJson<any[]>(hv);
        if (Array.isArray(arr) && arr.length) {
          const out = arr.map(coerceMembership).filter(Boolean) as any[];
          if (out.length) {
            // promote to v2 for future reads
            await kv.set(`user:${uid}:memberships`, out).catch(() => {});
            return dedupe(out);
          }
        }
      }
    } catch {
      // WRONGTYPE or other hash errors — ignore and continue
    }
  }

  // ---- 4) Legacy by email: copy forward to v2 ----
  if (email) {
    const legacy = await kv.get(`user:${email}:memberships`).catch(() => null);
    let arr: any[] | null = null;
    if (Array.isArray(legacy)) arr = legacy as any[];
    else if (typeof legacy === "string") arr = tryJson<any[]>(legacy);
    else if (legacy && typeof legacy === "object" && Array.isArray((legacy as any).memberships))
      arr = (legacy as any).memberships;

    if (Array.isArray(arr) && arr.length) {
      const out = arr.map(coerceMembership).filter(Boolean) as any[];
      if (out.length) {
        await kv.set(`user:${uid}:memberships`, out).catch(() => {});
        return dedupe(out);
      }
    }
  }

  return [];
}

/** Read a key that holds an array (either a JSON string or a native array). */
export async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key).catch(() => null);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    const parsed = tryJson<any[]>(raw);
    if (Array.isArray(parsed)) return parsed as T[];
  }
  if (raw && typeof raw === "object") {
    const maybe = (raw as any).items || (raw as any).data || (raw as any).list;
    if (Array.isArray(maybe)) return maybe as T[];
  }
  return [];
}