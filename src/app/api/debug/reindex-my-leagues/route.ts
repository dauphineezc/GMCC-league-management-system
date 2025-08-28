import { kv } from "@vercel/kv";
import { headers } from "next/headers";

export async function POST() {
  const userId = headers().get("x-user-id") || "";
  if (!userId) return Response.json({ ok:false, error:"no user" }, { status: 401 });

  const mships: { leagueId: string; teamId: string }[] =
    (await kv.get<any[]>(`user:${userId}:memberships`)) ?? [];

  let fixed = 0;
  for (const m of mships) {
    const team = (await kv.get<any>(`team:${m.teamId}`)) ?? null;
    if (!team) continue;

    const cardsKey = `league:${m.leagueId}:teams`;
    const idsKey   = `league:${m.leagueId}:teamIds`;

    const cards = (await kv.get<any[]>(cardsKey)) ?? [];
    const ids   = (await kv.get<string[]>(idsKey)) ?? [];

    const hadId   = ids.includes(m.teamId);
    const hadCard = cards.some(c => c.teamId === m.teamId);

    if (!hadId)   ids.push(m.teamId);
    if (!hadCard) cards.push({ teamId: m.teamId, name: team.name, description: team.description });

    if (!hadId || !hadCard) {
      await kv.set(cardsKey, cards);
      await kv.set(idsKey, ids);
      fixed++;
    }
  }
  return Response.json({ ok: true, fixed, userId });
}