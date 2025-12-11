// Unified Home Page - Uses permission-based rendering
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { kv } from "@vercel/kv";
import { DIVISIONS } from "@/lib/divisions";
import { getServerUser } from "@/lib/serverUser";
import TeamSummaryCard from "@/components/playerTeamSummaryCard";
import AdminLeagueCard from "@/components/adminLeagueSummaryCard";
import PublicLeagueTabsServer from "@/components/publicLeagueTabs.server";
import { readMembershipsForUid } from "@/lib/kvread";
import type { Game } from "@/types/domain";
import { batchGetTeams, batchGetTeamNames, batchGet, parseArrayFromKV } from "@/lib/kvBatch";

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

    // Step 5: Batch fetch league names for leagues not in DIVISIONS
    // Collect leagueIds from both memberships and teams
    const membershipLeagueIds = memberships.map(m => m.leagueId).filter((id): id is string => Boolean(id));
    const teamLeagueIds = Array.from(teamsMap.values()).map(t => t?.leagueId).filter((id): id is string => Boolean(id));
    const uniqueLeagueIds = [...new Set([...membershipLeagueIds, ...teamLeagueIds])];
    const leagueNameMap = new Map<string, string>();
    
    // First, add DIVISIONS leagues to the map
    DIVISIONS.forEach(d => {
      if (uniqueLeagueIds.includes(d.id)) {
        leagueNameMap.set(d.id, d.name);
      }
    });
    
    // Then, fetch league names for leagues not in DIVISIONS
    const leaguesToFetch = uniqueLeagueIds.filter(id => !leagueNameMap.has(id));
    if (leaguesToFetch.length > 0) {
      // Fetch leagues - try both hash and JSON formats
      const leaguePromises = leaguesToFetch.map(async (leagueId) => {
        const key = `league:${leagueId}`;
        // Try reading as hash first (for leagues created with writePatch)
        try {
          const h = (await kv.hgetall(key)) as Record<string, any> | null;
          if (h && typeof h === "object" && Object.keys(h).length) {
            return { leagueId, name: h.name };
          }
        } catch {}
        
        // Fall back to JSON format
        try {
          const g = (await kv.get(key)) as any;
          if (g && typeof g === "object" && g.name) {
            return { leagueId, name: g.name };
          }
        } catch {}
        
        return { leagueId, name: null };
      });
      
      const leagueResults = await Promise.all(leaguePromises);
      leagueResults.forEach(({ leagueId, name }) => {
        if (name && typeof name === 'string') {
          leagueNameMap.set(leagueId, name);
        }
      });
    }

    // Step 6: Process each membership using cached data
    playerTeams = memberships.map((m) => {
      const team = teamsMap.get(`team:${m.teamId}`) ?? {
        id: m.teamId,
        leagueId: m.leagueId,
        name: m.teamId,
        approved: false,
      };
      
      // Use team's leagueId if membership doesn't have it
      const effectiveLeagueId = m.leagueId ?? team.leagueId ?? "";

      let games = parseArrayFromKV(teamGamesResults.get(`team:${m.teamId}:games`));
      
      // Normalize dateTimeISO for team games
      games = games.map((g: any) => ({
        ...g,
        dateTimeISO: g.dateTimeISO ?? g.startTimeISO ?? g.start ?? g.date ?? null,
      }));
      
      // Always check league games if we have a leagueId (games might only be stored at league level)
      if (effectiveLeagueId) {
        const leagueGames = parseArrayFromKV(leagueGamesResults.get(`league:${effectiveLeagueId}:games`));
        const thisTeamName = norm(team.name ?? m.teamId);
        const thisTeamNameExact = team.name ?? m.teamId;

        const leagueGamesForTeam = leagueGames
          .filter((g: any) => {
            // First check by team ID
            const idHit =
              (g.homeTeamId && g.homeTeamId === m.teamId) ||
              (g.awayTeamId && g.awayTeamId === m.teamId);
            if (idHit) return true;
            
            // Then check by exact team name match
            const homeNameExact = g.homeTeamName;
            const awayNameExact = g.awayTeamName;
            if (homeNameExact === thisTeamNameExact || awayNameExact === thisTeamNameExact) return true;
            
            // Finally check by normalized name match
            const homeName = norm(g.homeTeamName);
            const awayName = norm(g.awayTeamName);
            return homeName === thisTeamName || awayName === thisTeamName;
          })
          .map((g: any) => ({
            ...g,
            dateTimeISO: g.dateTimeISO ?? g.startTimeISO ?? g.start ?? g.date ?? null,
          }));
        
        // Merge league games with team games (avoid duplicates)
        const existingGameIds = new Set(games.map((g: any) => g.id));
        const newLeagueGames = leagueGamesForTeam.filter((g: any) => !existingGameIds.has(g.id));
        games = [...games, ...newLeagueGames];
      }

      const withNames: Game[] = games.map((g: any) => ({
        ...g,
        homeTeamName: g.homeTeamName ?? (g.homeTeamId ? nameMap.get(g.homeTeamId) : undefined),
        awayTeamName: g.awayTeamName ?? (g.awayTeamId ? nameMap.get(g.awayTeamId) : undefined),
      }));

      const now = new Date();
      const next = withNames
        .filter((g) => {
          if (!g.dateTimeISO) return false;
          const gameDate = new Date(g.dateTimeISO);
          const status = (g.status || '').toLowerCase();
          // Include games that are in the future OR have status 'scheduled'
          return gameDate >= now || status === 'scheduled';
        })
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

      // Get league name from map or fallback
      const leagueName = effectiveLeagueId 
        ? (leagueNameMap.get(effectiveLeagueId) ?? effectiveLeagueId)
        : "Not Assigned to a League";

      return {
        id: m.teamId,
        name: team.name ?? m.teamId,
        approved: !!team.approved,
        leagueId: effectiveLeagueId,
        leagueName,
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
    <main className="home-main" style={{ padding: 20, display: "grid", gap: homeRole === "public" ? 10 : 30 }}>
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
            <p>You&apos;re signed in as <code>{user?.email ?? user?.id}</code>.</p>
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
          <div className="btn-row" style={{ marginTop: 20 }}>
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
            className="cards-grid-fixed admin-leagues-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(320px, 1fr))",
              gap: 20,
              alignItems: "start",
            }}
          >
            {adminLeagues.length ? (
              adminLeagues.map((lg) => (
                <div key={lg.leagueId}>
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
