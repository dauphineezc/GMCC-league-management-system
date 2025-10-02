// src/app/(superadmin)/superadmin/players/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv } from "@vercel/kv";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import SuperPlayerList from "@/components/superPlayerList";
import type { PlayerTeam, RosterRow, Team } from "@/types/domain";

async function smembers(key: string): Promise<string[]> {
  const v = (await kv.smembers(key)) as unknown;
  return Array.isArray(v) ? (v as string[]) : [];
}

export default async function SuperAdminPlayersPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) redirect("/");

  // 1) All teams we know about
  const teamIds = await smembers("teams:index");

  // 2) Build a unified roster and a per-user teams map
  const roster: RosterRow[] = [];
  const playerTeamsByUser: Record<string, PlayerTeam[]> = {};

  await Promise.all(
    teamIds.map(async (teamId) => {
      const team = (await kv.get<Team>(`team:${teamId}`)) || null;
      if (!team) return;

      const teamName = team.name ?? teamId;
      const leagueId = team.leagueId ?? undefined;

      const teamRoster =
        ((await kv.get<any[]>(`team:${teamId}:roster`)) as any[]) ?? [];
      const payments =
        ((await kv.get<Record<string, boolean>>(
          `team:${teamId}:payments`
        )) as Record<string, boolean>) ?? {};

      for (const r of teamRoster) {
        const paid = Boolean(payments[r.userId]);

        // unified roster row (for the list)
        roster.push({
          userId: r.userId,
          displayName: r.displayName,
          isManager: Boolean(r.isManager),
          paid,
          teamId,
          teamName,
        });

        // teams-by-user (for the popup)
        const bucket = (playerTeamsByUser[r.userId] ||= []);
        bucket.push({
          teamId,
          leagueId,
          teamName,
          isManager: Boolean(r.isManager),
          paid,
        });
      }
    })
  );

  // 3) Sort roster for a stable UI
  roster.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 className="page-title">
        Players
      </h1>
      <SuperPlayerList roster={roster} playerTeamsByUser={playerTeamsByUser} />
    </main>
  );
}