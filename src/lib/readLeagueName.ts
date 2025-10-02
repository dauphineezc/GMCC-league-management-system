// src/lib/readLeagueName.ts
import { kv } from "@vercel/kv";
import { DIVISIONS } from "@/lib/divisions";

export async function readLeagueName(leagueId: string): Promise<string> {
  // prefer hash
  try {
    const h = (await kv.hgetall(`league:${leagueId}`)) as Record<string, unknown> | null;
    if (h && typeof h === "object" && h.name) return String(h.name);
  } catch {}

  // fallback to plain GET object
  try {
    const g = (await kv.get(`league:${leagueId}`)) as any;
    if (g && typeof g === "object" && g.name) return String(g.name);
  } catch {}

  // last fallback: static divisions -> id
  return DIVISIONS.find(d => d.id === leagueId)?.name ?? leagueId;
}