// /src/app/api/admin/migrate-league-team-sets/route.ts
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";

function coerceTeamId(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : null;
  }
  if (typeof v === "object") {
    const id = (v as any)?.teamId ?? (v as any)?.id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

async function readIds(key: string): Promise<string[]> {
  // Try as a Set
  try {
    const set = (await kv.smembers(key)) as unknown;
    if (Array.isArray(set)) return (set as unknown[]).map(String).filter(Boolean);
  } catch { /* WRONGTYPE or missing */ }

  // Fallback: GET (string/array/CSV/JSON)
  let raw: unknown;
  try { raw = await kv.get(key); } catch { return []; }

  if (Array.isArray(raw)) return (raw as unknown[]).map(String).filter(Boolean);

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
    } catch {
      if (s.includes(",")) return s.split(",").map(t => t.trim()).filter(Boolean);
      return [s];
    }
  }

  return [];
}

async function readCardObjs(key: string): Promise<any[]> {
  // legacy card objects (e.g., [{teamId, name}, ...])
  let raw: unknown;
  try { raw = await kv.get(key); } catch { return []; }
  if (Array.isArray(raw)) return raw as any[];
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  return [];
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user?.superadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dry = searchParams.get("dry") === "1";

  // collect league ids
  let ids: string[] = searchParams.getAll("league");
  if (!ids.length) {
    try {
      const idx = (await kv.smembers("leagues:index")) as string[] | unknown;
      if (Array.isArray(idx)) ids = (idx as unknown[]).map(String).filter(Boolean);
    } catch {}
  }
  ids = Array.from(new Set(ids));

  const report: Array<{ leagueId: string; before: number; wrote: number }> = [];

  for (const leagueId of ids) {
    // Collect ids from all legacy places
    const fromSetTeams = await readIds(`league:${leagueId}:teams`);     // may already be a set
    const fromTeamIds  = await readIds(`league:${leagueId}:teamIds`);   // legacy ids
    const fromCards    = await readCardObjs(`league:${leagueId}:teams`) // legacy card_objs
                              .then(arr => arr.map(coerceTeamId).filter(Boolean) as string[]);

    const union = Array.from(new Set([
      ...fromSetTeams, ...fromTeamIds, ...fromCards,
    ])).filter(Boolean);

    if (!dry) {
      // Normalize forward: overwrite teams key with SET
      await kv.del(`league:${leagueId}:teams`);
      if (union.length) await kv.sadd(`league:${leagueId}:teams`, ...union);
      // Optional: remove old teamIds key to avoid future confusion
      await kv.del(`league:${leagueId}:teamIds`);
    }

    report.push({ leagueId, before: fromSetTeams.length + fromTeamIds.length + fromCards.length, wrote: union.length });
  }

  return NextResponse.json({ ok: true, dry, count: report.length, report });
}