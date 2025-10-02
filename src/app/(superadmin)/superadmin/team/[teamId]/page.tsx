export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { kv } from "@vercel/kv";

import { getServerUser } from "@/lib/serverUser";
import AdminTeamTabs from "@/components/adminTeamTabs";
import DeleteTeamButton from "@/components/deleteResourceButton";
import { readArr } from "@/lib/kvread";

import type { Team, RosterEntry, Game, PlayerTeam } from "@/types/domain";

type Params = { teamId: string };

export default async function SuperAdminTeamPage({ params }: { params: Params }) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) redirect("/");

  const teamId = params.teamId;

  // Team
  const team = (await kv.get<Team>(`team:${teamId}`)) ?? null;
  if (!team) notFound();

  const leagueId = team.leagueId ?? "";

  // Roster + payments (payments stored under team:<id>:payments as { [userId]: boolean })
  const roster = (await readArr<RosterEntry>(`team:${teamId}:roster`)) ?? [];
  const payments =
    (await kv.get<Record<string, boolean>>(`team:${teamId}:payments`)) ?? {};

  const rosterRows = roster.map((r) => ({
    userId: r.userId,
    displayName: r.displayName,
    isManager: Boolean(r.isManager),
    paid: Boolean(payments[r.userId]),
    teamId,
    teamName: team.name ?? teamId,
  }));

  // Games: prefer team:<id>:games; else derive from league games
  let games = await readArr<Game>(`team:${teamId}:games`);
  if (!games.length && leagueId) {
    const leagueGames = await readArr<Game>(`league:${leagueId}:games`);
    games = leagueGames.filter(
      (g) => g.homeTeamId === teamId || g.awayTeamId === teamId
    );
  }

  // Fill any missing display names for opponents from KV team docs
  const ids = Array.from(
    new Set([teamId, ...games.flatMap((g) => [g.homeTeamId, g.awayTeamId])])
  ).filter(Boolean) as string[];

  const nameMap = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      const t = await kv.get<Team>(`team:${id}`);
      if (t?.name) nameMap.set(id, t.name);
    })
  );

  const gamesWithNames = games.map((g) => ({
    ...g,
    homeTeamName: g.homeTeamName ?? (g.homeTeamId ? nameMap.get(g.homeTeamId) : undefined),
    awayTeamName: g.awayTeamName ?? (g.awayTeamId ? nameMap.get(g.awayTeamId) : undefined),
  }));

  // Optional: supply extra teams-by-user map for the player popup (can be empty)
  const playerTeamsByUser: Record<string, PlayerTeam[]> = {};

  /* ---------- server action: toggle paid ---------- */
  async function togglePaid(formData: FormData) {
    "use server";
    const uid = String(formData.get("userId") || "");
    if (!uid) return;

    const key = `team:${teamId}:payments`;
    const current =
      (await kv.get<Record<string, boolean>>(key)) ?? {};
    const next = { ...current, [uid]: !Boolean(current[uid]) };
    await kv.set(key, next);

    // refresh this page so the badge/button update
    revalidatePath(`/superadmin/team/${teamId}`);
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">{team.name}</h1>
        </div>
      </header>

      <nav className="mb-2">
        <Link href="/superadmin/teams" className="text-blue-600 hover:underline">
          ← Back to All Teams
        </Link>
      </nav>

      <AdminTeamTabs
        teamId={teamId}
        teamName={team.name}
        leagueId={leagueId}
        roster={rosterRows}
        games={gamesWithNames}
        onTogglePaid={togglePaid}
        playerTeamsByUser={playerTeamsByUser}
      />

      <DeleteTeamButton
        kind="team"
        id={teamId}
        name={team.name}
        redirectTo={`/superadmin/leagues/${team.leagueId ?? ""}`}
        variant="link"
      >
        Delete Team
      </DeleteTeamButton>
    </main>
  );
}