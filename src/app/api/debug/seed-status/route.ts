// src/app/api/debug/seed-status/route.ts
import { kv } from "@vercel/kv";

export async function GET() {
  const index = (await kv.get<{id:string; name:string}[]>("league:index")) ?? [];
  const details = await Promise.all(index.map(async l => {
    const teams = (await kv.get<string[]>(`league:${l.id}:teamIds`)) ?? [];
    return { leagueId: l.id, teams: teams.length };
  }));
  return Response.json({ leagues: index.length, details });
}
