// src/app/api/teams/[teamId]/route.ts
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";

async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") try { return JSON.parse(raw) as T[]; } catch {}
  return [];
}
async function writeArr<T>(key: string, arr: T[]) {
  await kv.set(key, arr);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { teamId: string } }
) {
  const user = await getServerUser();
  if (!user) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const teamId = params.teamId;
  const team = (await kv.get<any>(`team:${teamId}`)) || null;
  if (!team) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const leagueId: string | null = team?.leagueId ?? null;

  const isLeagueAdmin =
    !!leagueId && Array.isArray(user.leagueAdminOf) && user.leagueAdminOf.includes(leagueId);

  if (!(user.superadmin || isLeagueAdmin)) {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // 1) Remove from global index
  await kv.srem("teams:index", teamId);

  // 2) Remove from league team set
  if (leagueId) {
    await kv.srem(`league:${leagueId}:teams`, teamId);

    // optional: prune league players aggregate
    const players = (await readArr<any>(`league:${leagueId}:players`)).filter((p) => p?.teamId !== teamId);
    await writeArr(`league:${leagueId}:players`, players);
  }

  // 3) Remove memberships for rostered users
  const roster = await readArr<{ userId: string }>(`team:${teamId}:roster`);
  await Promise.all(
    roster.map(async ({ userId }) => {
      const key = `user:${userId}:memberships`;
      const m = await readArr<any>(key);
      const filtered = m.filter((x) => x?.teamId !== teamId);
      await writeArr(key, filtered);
      // If you stored private roster docs per user, clean those too:
      await kv.del(`team:${teamId}:roster:private:${userId}`);
    })
  );

  // 4) Nuke common team keys
  await kv.del(
    `team:${teamId}`,
    `team:${teamId}:roster`,
    `team:${teamId}:games`,
    `team:${teamId}:payments`,
    `team:${teamId}:invites`
  );

  return Response.json({ ok: true, deleted: teamId });
}