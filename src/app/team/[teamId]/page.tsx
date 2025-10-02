export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { kv } from "@vercel/kv";
import TeamTabs from "@/components/teamTabs";
import type { Team, RosterEntry, StandingRow, Game } from "@/types/domain";
import { getServerUser } from "@/lib/serverUser";

// small tolerant array reader (or import your shared helper if you added one)
async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}

export default async function TeamPage({ params }: { params: { teamId: string } }) {
  const teamId = params.teamId;

  // Team & roster
  const team = (await kv.get<Team>(`team:${teamId}`)) || null;
  if (!team) notFound();

  const roster = await readArr<RosterEntry>(`team:${teamId}:roster`);

  // Standings (league-level)
  const standings = ((await kv.get<StandingRow[]>(`league:${team.leagueId}:standings`)) ?? []) as StandingRow[];
  const standing = standings.find((s) => s.teamId === teamId) || null;

  // Games: prefer team key, else derive from league games
  let games = await readArr<Game>(`team:${teamId}:games`);
  if (!games.length) {
    const leagueGames = await readArr<Game>(`league:${team.leagueId}:games`);
    games = leagueGames.filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);
  }

  /* ==== team name hydration for games (safe even if ids/names missing) ==== */

  // Build unique teamIds, filter undefined
  const teamIds = Array.from(
    new Set([teamId, ...games.flatMap((g) => [g.homeTeamId, g.awayTeamId])])
  ).filter((x): x is string => Boolean(x));

  // Map id -> display name from KV
  const idToName = new Map<string, string>();
  await Promise.all(
    teamIds.map(async (id) => {
      const t = await kv.get<Team>(`team:${id}`);
      if (t?.name) idToName.set(id, t.name);
    })
  );

  const resolveName = (explicit?: string, id?: string) =>
    explicit ?? (id ? idToName.get(id) ?? id : "—");

  const gamesWithNames: Game[] = games.map((g) => ({
    ...g,
    homeTeamName: resolveName(g.homeTeamName, g.homeTeamId),
    awayTeamName: resolveName(g.awayTeamName, g.awayTeamId),
  }));

  /* ==== membership bits (UID-based) ==== */

  const user = await getServerUser(); // { id, email, superadmin, leagueAdminOf? }
  const memberships = user
    ? await readArr<{ leagueId: string; teamId: string; isManager: boolean }>(
        `user:${user.id}:memberships`
      )
    : [];

  const meOnThisTeam = memberships.find((m) => m.teamId === teamId);
  const isMember = Boolean(meOnThisTeam);
  const isManager = Boolean(meOnThisTeam?.isManager);

  const record =
    standing?.rank != null
      ? `Rank #${standing.rank}`
      : standing
      ? `${standing.wins ?? 0}-${standing.losses ?? 0}${
          standing.ties ? `-${standing.ties}` : ""
        }`
      : "—";

  return (
    <main style={{ display: "grid", gap: 16 }}>
      {/* Header row: name left, approved chip right */}
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">{team.name}</h1>
          <div className="team-subtle">{record}</div>
        </div>

        <div className="chip-group">
          {team.approved ? (
            <span className="chip chip--ok">✅ Approved</span>
          ) : (
            <span className="chip chip--pending">⏳ Pending Approval</span>
          )}
        </div>
      </header>

      {team.description ? (
        <section className="team-desc card--soft">{team.description}</section>
      ) : null}

      {/* Tabs */}
      <TeamTabs
        teamId={teamId}
        teamName={team.name}
        leagueId={team.leagueId || ""}
        roster={roster}
        games={gamesWithNames}
        isMember={isMember}
        isManager={isManager}
      />
    </main>
  );
}