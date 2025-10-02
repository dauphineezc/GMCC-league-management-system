export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { kv } from "@vercel/kv";
import { DIVISIONS } from "@/lib/divisions";
import TeamSummaryCard from "@/components/playerTeamSummaryCard";
import PublicLeagueTabsServer from "@/components/publicLeagueTabs.server";
import { getServerUser } from "@/lib/serverUser";
import { readMembershipsForUid, readArr } from "@/lib/kvread";
import type { Team, Game } from "@/types/domain";

const norm = (s: string | undefined | null) => String(s ?? "").trim().toLowerCase();

export default async function PlayerHome() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const memberships = await readMembershipsForUid(user.id, user.email ?? null);

  // Resolve team names, approval, and next game for each membership
  const enrichedTeams = await Promise.all(
    memberships.map(async (m) => {
      const team =
        (await kv.get<Team>(`team:${m.teamId}`)) ?? {
          id: m.teamId,
          leagueId: m.leagueId,
          name: m.teamId,
          approved: false,
        };

      // Prefer per-team list; else derive from league list
      let games = await readArr<Game>(`team:${m.teamId}:games`);
      if (!games.length) {
        const leagueGames = await readArr<any>(`league:${m.leagueId}:games`);
        const thisTeamName = norm(team.name ?? m.teamId);

        games = leagueGames
          .filter((g) => {
            const idHit =
              (g.homeTeamId && g.homeTeamId === m.teamId) ||
              (g.awayTeamId && g.awayTeamId === m.teamId);
            if (idHit) return true;
            const homeName = norm(g.homeTeamName);
            const awayName = norm(g.awayTeamName);
            return homeName === thisTeamName || awayName === thisTeamName;
          })
          .map((g) => ({
            ...g,
            dateTimeISO: g.dateTimeISO ?? g.startTimeISO ?? g.start ?? g.date ?? null,
          })) as Game[];
      }

      // Fill missing team display names once
      const ids = Array.from(new Set([m.teamId, ...games.flatMap((g) => [g.homeTeamId, g.awayTeamId])]))
        .filter(Boolean) as string[];

      const nameMap = new Map<string, string>();
      await Promise.all(
        ids.map(async (id) => {
          const t = await kv.get<Team>(`team:${id}`);
          if (t?.name) nameMap.set(id, t.name);
        })
      );

      const withNames: Game[] = games.map((g) => ({
        ...g,
        homeTeamName: g.homeTeamName ?? (g.homeTeamId ? nameMap.get(g.homeTeamId) : undefined),
        awayTeamName: g.awayTeamName ?? (g.awayTeamId ? nameMap.get(g.awayTeamId) : undefined),
      }));

      const now = Date.now();
      const next = withNames
        .filter((g) => g.dateTimeISO && new Date(g.dateTimeISO).getTime() >= now)
        .sort((a, b) => +new Date(a.dateTimeISO!) - +new Date(b.dateTimeISO!))[0];

      let nextGameText: string | undefined;
      if (next?.dateTimeISO) {
        const dt = new Date(next.dateTimeISO);
        const when = new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(dt);

        const thisName = norm(team.name ?? m.teamId);
        const isHome =
          (next.homeTeamId && next.homeTeamId === m.teamId) ||
          norm(next.homeTeamName) === thisName;

        const opponent = isHome
          ? (next.awayTeamName ??
              (next.awayTeamId ? nameMap.get(next.awayTeamId) ?? next.awayTeamId : undefined))
          : (next.homeTeamName ??
              (next.homeTeamId ? nameMap.get(next.homeTeamId) ?? next.homeTeamId : undefined));

        const oppText = opponent && norm(opponent) !== thisName ? ` • vs ${opponent}` : "";
        nextGameText = `${when}${oppText}`;
      }

      return {
        id: m.teamId,
        name: team.name ?? m.teamId,
        approved: !!team.approved,
        leagueId: m.leagueId,
        leagueName: DIVISIONS.find((d) => d.id === m.leagueId)?.name ?? m.leagueId ?? "Unknown League",
        isManager: m.isManager,
        nextGameText,
      };
    })
  );

  return (
    <main style={{ padding: 20, display: "grid", gap: 30 }}>
      {/* Welcome */}
      <section>
        <h1 className="page-title">Welcome</h1>
        <p>You're signed in as <code>{user.email ?? user.id}</code>.</p>
        <Link className="btn btn--outline" href="/logout">Sign out</Link>
      </section>

      {/* My Teams */}
      <section id="teams">
        <h2 className="section-title">My Teams</h2>
        <div className="cards-grid">
          {enrichedTeams.length ? (
            enrichedTeams.map((t) => (
              <TeamSummaryCard
                key={t.id}
                name={t.name}
                league={t.leagueName}
                approved={t.approved}
                nextGameText={t.nextGameText}
                href={`/team/${t.id}`}
                isManager={t.isManager}
              />
            ))
          ) : (
            <p style={{ color: "var(--muted)" }}>No teams yet.</p>
          )}
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Link href="/create-team" className="btn btn--outline">Create Team</Link>
          <Link href="/join" className="btn btn--outline">Join with Code</Link>
        </div>
      </section>

      {/* Public leagues — powered by the server wrapper */}
      <section id="public-leagues">
        <h2 className="section-title">Leagues</h2>
        <PublicLeagueTabsServer defaultTab="basketball" />
      </section>
    </main>
  );
}