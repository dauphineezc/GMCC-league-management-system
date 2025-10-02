// src/app/api/superadmin/leagues/[leagueId]/route.ts
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";

async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") try { return JSON.parse(raw) as T[]; } catch {}
  return [];
}

export async function DELETE(
  _req: Request,
  { params }: { params: { leagueId: string } }
) {
  const user = await getServerUser();
  if (!user?.superadmin) {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const leagueId = params.leagueId;

  // Detach any teams assigned to the league
  const teamIds = (await kv.smembers(`league:${leagueId}:teams`)) as string[] || [];

  await Promise.all(
    teamIds.map(async (teamId) => {
      const t = (await kv.get<any>(`team:${teamId}`)) || null;
      if (!t) return;
      t.leagueId = null;
      t.updatedAt = new Date().toISOString();
      await kv.set(`team:${teamId}`, t);
    })
  );

  await kv.srem("leagues:index", leagueId);
  await kv.del(
    `league:${leagueId}`,
    `league:${leagueId}:teams`,
    `league:${leagueId}:players`,
    `league:${leagueId}:games`,
    `league:${leagueId}:standings`,
    `league:${leagueId}:announcements`
  );

  return Response.json({ ok: true, deleted: leagueId, detachedTeams: teamIds });
}