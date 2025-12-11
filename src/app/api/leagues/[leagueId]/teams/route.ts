// API route to get teams for a league
import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { parseArrayFromKV } from "@/lib/kvBatch";

async function smembersSafe(key: string): Promise<string[]> {
  try {
    const v = (await kv.smembers(key)) as unknown;
    if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
  } catch {
    /* ignore WRONGTYPE */
  }
  return [];
}

async function readArr<T = any>(key: string): Promise<T[]> {
  let raw: unknown;
  try {
    raw = await kv.get(key);
  } catch {
    return [];
  }
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

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const leagueId = params.leagueId;
    
    // Get team IDs from the league
    const teamIds = await smembersSafe(`league:${leagueId}:teams`);
    const seeds = new Set<string>(teamIds);
    
    // Fallback: get team IDs from players if teams set is empty
    if (seeds.size === 0) {
      const players = await readArr<any>(`league:${leagueId}:players`);
      for (const tid of players.map((p) => String(p?.teamId ?? "")).filter(Boolean)) {
        seeds.add(tid);
      }
    }

    const ids = Array.from(seeds);
    
    // Batch fetch all teams
    const { batchGetTeams } = await import("@/lib/kvBatch");
    const teamsMap = await batchGetTeams(ids);
    
    // Build team list with names
    const teams = ids
      .map((id) => {
        const t = teamsMap.get(`team:${id}`);
        return {
          teamId: id,
          name: t?.name ?? id,
        };
      })
      .filter(t => t.name) // Only include teams with names
      .sort((a, b) => (a.name || a.teamId).localeCompare(b.name || b.teamId, undefined, { sensitivity: "base" }));

    return Response.json(teams);
  } catch (error: any) {
    console.error("Error fetching teams for league:", error);
    return Response.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}

