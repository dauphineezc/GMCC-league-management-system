// /src/app/api/dev/reindex/route.ts
import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { DIVISIONS } from "@/lib/divisions";

export async function POST() {
  // rebuild leagues:index from DIVISIONS plus any leagues already present on teams
  const teamIds = (await kv.smembers("teams:index")) as string[] || [];
  const leaguesFromTeams = new Set<string>();
  for (const id of teamIds) {
    const t = await kv.get<any>(`team:${id}`);
    if (t?.leagueId) leaguesFromTeams.add(t.leagueId);
  }
  const union = new Set<string>([...DIVISIONS.map(d => d.id), ...leaguesFromTeams]);
  if (union.size) await kv.del("leagues:index"); // optional wipe
  if (union.size) await kv.sadd("leagues:index", [...union]);

  return NextResponse.json({ ok: true, leagues: [...union].length });
}