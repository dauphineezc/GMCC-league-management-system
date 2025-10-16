// Unified Home Page - Uses permission-based rendering
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { kv } from "@vercel/kv";
import { DIVISIONS } from "@/lib/divisions";
import { getServerUser } from "@/lib/serverUser";
import { getUserLeagueRole } from "@/lib/permissions";
import TeamSummaryCard from "@/components/playerTeamSummaryCard";
import AdminLeagueCard from "@/components/adminLeagueSummaryCard";
import PublicLeagueTabsServer from "@/components/publicLeagueTabs.server";
import { readMembershipsForUid, readArr } from "@/lib/kvread";
import type { Team, Game } from "@/types/domain";
import { batchGetTeams, batchGetTeamNames, batchGet } from "@/lib/kvBatch";

/* ---------------- helpers ---------------- */

const norm = (s: string | undefined | null) => String(s ?? "").trim().toLowerCase();

async function smembersSafe(key: string): Promise<string[]> {
  try {
    const v = (await kv.smembers<string[]>(key)) ?? [];
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function readLeagueName(leagueId: string): Promise<string> {
  try {
    const h = (await kv.hgetall(`league:${leagueId}`)) as Record<string, unknown> | null;
    if (h && typeof h === "object" && "name" in h && h.name) return String(h.name);
  } catch {}
  const g = (await kv.get(`league:${leagueId}`)) as any;
  if (g && typeof g === "object" && g?.name) return String(g.name);
  return DIVISIONS.find(d => d.id === leagueId)?.name ?? leagueId;
}

type TeamCard = { teamId: string; name: string; approved?: boolean };

async function getMergedTeams(leagueId: string): Promise<TeamCard[]> {
  const teamIds = await smembersSafe(`league:${leagueId}:teams`);
  const rows = await Promise.all(
    teamIds.map(async (id) => {
      const t = (await kv.get<Record<string, any>>(`team:${id}`)) || null;
      return {
        teamId: id,
        name: t?.name ?? id,
        approved: Boolean(t?.approved),
      } as TeamCard;
    })
  );
  rows.sort((a, b) =>
    (a.name || a.teamId).localeCompare(b.name || b.teamId, undefined, { sensitivity: "base" })
  );
  return rows;
}

/* ---------------- Page Component ---------------- */

export default async function UnifiedHome() {
  const user = await getServerUser();

  // Determine user's role for home page display
  // Priority: superadmin > admin > player > public
  let homeRole: "public" | "player" | "admin" | "superadmin" = "public";
  let isAnyLeagueAdmin = false;

  if (user) {
    if (user.superadmin) {
      homeRole = "superadmin";
    } else {
      // Check if user is admin of any league
      const adminKey = `admin:${user.id}:leagues`;
      let managed = await smembersSafe(adminKey);

      // Legacy email set check
      if (!managed.length && user.email) {
        const legacy = await smembersSafe(`admin:${user.email}:leagues`);
        if (legacy.length) {
          await kv.sadd(adminKey, ...legacy);
          managed = legacy;
        }
      }

      // Infer from league docs
      const idx = await smembersSafe("leagues:index");
      const inferred: string[] = [];
      await Promise.all(
        idx.map(async (id) => {
          let L: Record<string, any> | null = null;
          try {
            const h = (await kv.hgetall(`league:${id}`)) as Record<string, any> | null;
            if (h && typeof h === "object" && Object.keys(h).length) L = h;
          } catch {}
          if (!L) {
            const g = (await kv.get(`league:${id}`)) as any;
            if (g && typeof g === "object") L = g;
          }
          const adminUserId = L ? (L.adminUserId ?? L.ownerUserId ?? L.managerUserId ?? null) : null;
          if (adminUserId && String(adminUserId) === user.id) inferred.push(id);
        })
      );

      // Claims
      const claims = Array.isArray(user.leagueAdminOf) ? user.leagueAdminOf : [];

      // Merge
      managed = Array.from(new Set([...managed, ...inferred, ...claims])).filter(Boolean);

      if (managed.length) {
        homeRole = "admin";
        isAnyLeagueAdmin = true;
        // Normalize back to set
        await kv.del(adminKey);
        await kv.sadd(adminKey, ...managed);
      } else {
        homeRole = "player";
      }
    }
  }

  // Fetch data based on role
  let playerTeams: Array<{
    id: string;
    name: string;
    approved: boolean;
    leagueId: string;
    leagueName: string;
    isManager: boolean;
    nextGameText?: string;
  }> = [];

  let adminLeagues: Array<{
    leagueId: string;
    leagueName: string;
    teams: TeamCard[];
  }> = [];

  // Player data - OPTIMIZED with batch operations
  // OLD: 50-100+ sequential KV calls
  // NEW: ~5-10 batch calls total
  if (homeRole === "player" && user) {
    const memberships = await readMembershipsForUid(user.id, user.email ?? null);

    // Step 1: Batch fetch all teams
    const teamIds = memberships.map(m => m.teamId);
    const teamsMap = await batchGetTeams(teamIds);
    
    // Step 2: Batch fetch all team games and league games
    const teamGamesKeys = teamIds.map(id => `team:${id}:games`);
    const leagueIds = [...new Set(memberships.map(m => m.leagueId).filter(Boolean))];
    const leagueGamesKeys = leagueIds.map(id => `league:${id}:games`);
    
    const [teamGamesResults, leagueGamesResults] = await Promise.all([
      batchGet<any>(teamGamesKeys),
      batchGet<any>(leagueGamesKeys),
    ]);
    
    // Step 3: Collect all team IDs mentioned in all games for name lookup
    const allGameTeamIds = new Set<string>(teamIds);
    const addTeamIdsFromGames = (games: any[]) => {
      games.forEach(g => {
        if (g.homeTeamId) allGameTeamIds.add(g.homeTeamId);
        if (g.awayTeamId) allGameTeamIds.add(g.awayTeamId);
      });
    };
    
    teamGamesResults.forEach(games => {
      if (Array.isArray(games)) addTeamIdsFromGames(games);
    });
    leagueGamesResults.forEach(games => {
      if (Array.isArray(games)) addTeamIdsFromGames(games);
    });
    
    // Step 4: Batch fetch all team names
    const nameMap = await batchGetTeamNames(Array.from(allGameTeamIds));

    // Step 5: Process each membership using cached data
    playerTeams = memberships.map((m) => {
      const team = teamsMap.get(`team:${m.teamId}`) ?? {
        id: m.teamId,
        leagueId: m.leagueId,
        name: m.teamId,
        approved: false,
      };

      let games = teamGamesResults.get(`team:${m.teamId}:games`);
      games = Array.isArray(games) ? games : [];
      
      if (!games.length) {
        const leagueGames = leagueGamesResults.get(`league:${m.leagueId}:games`);
        const leagueGamesArray = Array.isArray(leagueGames) ? leagueGames : [];
        const thisTeamName = norm(team.name ?? m.teamId);

        games = leagueGamesArray
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
          }));
      }

      const withNames: Game[] = games.map((g: any) => ({
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
        leagueId: m.leagueId ?? "",
        leagueName: DIVISIONS.find((d) => d.id === m.leagueId)?.name ?? m.leagueId ?? "Unknown League",
        isManager: m.isManager,
        nextGameText,
      };
    });

    // Sort player teams alphabetically by team name
    playerTeams.sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }

  // Admin data
  if (homeRole === "admin" && user) {
    const adminKey = `admin:${user.id}:leagues`;
    const managed = await smembersSafe(adminKey);
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

    adminLeagues = (await Promise.all(
      managed.map(async (leagueId) => {
        const leagueName = await readLeagueName(leagueId);
        const teams = await getMergedTeams(leagueId);
        return { leagueId, leagueName, teams };
      })
    )).sort((a, b) => {
      const byName = collator.compare(a.leagueName || a.leagueId, b.leagueName || b.leagueId);
      return byName !== 0 ? byName : collator.compare(a.leagueId, b.leagueId);
    });
  }

  return (
    <main style={{ padding: 20, display: "grid", gap: homeRole === "public" ? 10 : 30 }}>
      {/* Welcome Section */}
      <section>
        <h1 className="page-title">Welcome</h1>
        {homeRole === "public" ? (
          <>
            <Link className="btn btn--primary" href="/login" style={{ marginTop: 10 }}>
              Sign in
            </Link>
          </>
        ) : (
          <>
            <p>You're signed in as <code>{user?.email ?? user?.id}</code>.</p>
            <Link className="btn btn--outline" href="/logout">Sign out</Link>
          </>
        )}
      </section>

      {/* Player Section - My Teams */}
      {homeRole === "player" && (
        <section id="teams">
          <h2 className="section-title">My Teams</h2>
          <div className="cards-grid">
            {playerTeams.length ? (
              playerTeams.map((t) => (
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
      )}

      {/* Admin Section - My Leagues */}
      {homeRole === "admin" && (
        <section id="leagues">
          <h2 className="section-title">My Leagues</h2>
          <div
            className="cards-grid-fixed"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(320px, 1fr))",
              gap: 20,
              alignItems: "start",
            }}
          >
            {adminLeagues.length ? (
              adminLeagues.map((lg) => (
                <div className="card-scale-90" key={lg.leagueId}>
                  <AdminLeagueCard
                    leagueId={lg.leagueId}
                    leagueName={lg.leagueName}
                    teams={lg.teams}
                  />
                </div>
              ))
            ) : (
              <p className="muted">No managed leagues yet.</p>
            )}
          </div>
        </section>
      )}

      {/* Public Leagues - Everyone sees this */}
      <section id="public-leagues">
        <h2 className="section-title">Leagues</h2>
        <PublicLeagueTabsServer defaultTab="basketball" />
      </section>
    </main>
  );
}
