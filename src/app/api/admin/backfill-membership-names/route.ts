import { kv } from "@vercel/kv";
import { DIVISIONS } from "@/lib/divisions";

export async function POST() {
  let updated = 0;

  // naive scan: iterate all known leagues -> teamIds -> roster -> users’ memberships
  for (const d of DIVISIONS) {
    const ids = (await kv.get<string[]>(`league:${d.id}:teamIds`)) ?? [];
    for (const teamId of ids) {
      const team = (await kv.get<any>(`team:${teamId}`)) ?? {};
      const roster = (await kv.get<{ userId: string }[]>(`team:${teamId}:roster`)) ?? [];
      const leagueName = d.name;

      for (const { userId } of roster) {
        const arr = (await kv.get<any[]>(`user:${userId}:memberships`)) ?? [];
        const i = arr.findIndex((m) => m.teamId === teamId);
        if (i >= 0) {
          const before = JSON.stringify(arr[i]);
          arr[i] = {
            ...arr[i],
            leagueId: team.leagueId ?? d.id,
            leagueName,
            teamName: arr[i].teamName ?? team.name ?? teamId,
          };
          if (JSON.stringify(arr[i]) !== before) {
            updated++;
            await kv.set(`user:${userId}:memberships`, arr);
          }
        }
      }
    }
  }
  return Response.json({ ok: true, updated });
}


/*
fetch("/api/admin/backfill-membership-names", { method: "POST" }) .then(r => r.json()).then(console.log);
*/