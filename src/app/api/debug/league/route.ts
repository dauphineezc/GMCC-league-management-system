import { kv } from "@vercel/kv";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const teams = (await kv.get<any[]>(`league:${id}:teams`)) ?? [];
  const teamIds = (await kv.get<string[]>(`league:${id}:teamIds`)) ?? [];
  return Response.json({ id, teams, teamIds, count: teams.length });
}
