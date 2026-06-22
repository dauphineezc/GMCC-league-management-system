// /src/lib/rosterAggregate.ts
import { adminAuth } from "@/lib/firebaseAdmin";
import { DIVISIONS } from "@/lib/divisions";
import { readLeagueName } from "@/lib/readLeagueName";
import { getAdminDisplayName } from "@/lib/adminUserLookup";
import { smembersSafe, getTeamsForLeague } from "@/lib/kvHelpers";
import { batchGetRosters, batchGetPayments } from "@/lib/kvBatch";
import type { PlayerTeam, RosterRow } from "@/types/domain";

/** Build a global roster (all player memberships) + a mapping for the popup */
export async function buildGlobalPlayerRoster() {
  // Prefer KV index; fall back to static DIVISIONS ids if your seed didn't write the index.
  const indexed = await smembersSafe("leagues:index");
  const leagueIds = indexed.length ? indexed : DIVISIONS.map(d => d.id);

  const roster: RosterRow[] = [];
  const playerTeamsByUser: Record<string, PlayerTeam[]> = {};

  // walk leagues → teams → team rosters (batch KV reads per league)
  for (const leagueId of leagueIds) {
    const leagueName = await readLeagueName(leagueId);
    const teams = await getTeamsForLeague(leagueId);
    const teamIds = teams.map((t) => t.teamId);
    const [rostersMap, paymentsMap] = await Promise.all([
      batchGetRosters(teamIds),
      batchGetPayments(teamIds),
    ]);

    for (const t of teams) {
      const r = rostersMap.get(t.teamId) ?? [];
      const payMap = paymentsMap.get(t.teamId) ?? {};

      for (const entry of r) {
        const row: RosterRow = {
          userId: entry.userId,
          displayName: entry.displayName,
          teamId: t.teamId,
          teamName: t.name,
          isManager: Boolean(entry.isManager),
          paid: Boolean(payMap?.[entry.userId]),
        };
        roster.push(row);

        const pt: PlayerTeam = {
          teamId: t.teamId,
          teamName: t.name,
          isManager: Boolean(entry.isManager),
          paid: Boolean(payMap?.[entry.userId]),
          leagueId,
          leagueName: leagueName,
        };
        (playerTeamsByUser[entry.userId] ??= []).push(pt);
      }
    }
  }

  // stable, friendly order
  roster.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { roster, playerTeamsByUser };
}

/** Build an 'admin roster' that reuses roster styling (1 row per league an admin manages). */
export async function buildAdminRosterLikeRows() {
  // We'll show one row per {admin, league}, and one special row for superadmins.
  const out: RosterRow[] = [];
  const map: Record<string, PlayerTeam[]> = {};

  // Cache league names to avoid repeated lookups
  const leagueNameCache = new Map<string, string>();
  const getLeagueName = async (id: string) => {
    if (!leagueNameCache.has(id)) {
      leagueNameCache.set(id, await readLeagueName(id));
    }
    return leagueNameCache.get(id)!;
  };

  let token: string | undefined = undefined;
  do {
    const res = await adminAuth.listUsers(1000, token);
    for (const u of res.users) {
      const claims = (u.customClaims ?? {}) as any;
      const uid = u.uid;
      
      // Use getAdminDisplayName to check KV storage first, then Firebase Auth
      const displayName = (await getAdminDisplayName(uid)) ?? u.displayName ?? u.email ?? uid;

      // Check both claims and KV sets BEFORE filtering
      const leaguesFromClaims: string[] = Array.isArray(claims.leagueAdminOf) ? claims.leagueAdminOf : [];
      
      // Also check KV sets for admin leagues
      let leaguesFromKV: string[] = [];
      try {
        leaguesFromKV = await smembersSafe(`admin:${uid}:leagues`);
      } catch {}
      
      // Also check email-based key for legacy support
      if (u.email) {
        try {
          const emailLeagues = await smembersSafe(`admin:${u.email}:leagues`);
          leaguesFromKV = [...leaguesFromKV, ...emailLeagues];
        } catch {}
      }
      
      // Merge and deduplicate
      const leagues = Array.from(new Set([...leaguesFromClaims, ...leaguesFromKV]));

      // Skip if not superadmin and has no leagues
      const isAdmin = !!claims.superadmin || leagues.length > 0;
      if (!isAdmin) continue;

      // Superadmin row (single "All Leagues" pseudo-membership)
      if (claims.superadmin) {
        const row: RosterRow = {
          userId: uid,
          displayName,
          teamId: "all-leagues",
          teamName: "All Leagues",
          isManager: true,     // renders the "Team Manager" chip; visually matches
          paid: true,          // renders a green badge (purely stylistic)
        };
        out.push(row);

        (map[uid] ??= []).push({
          teamId: "all-leagues",
          teamName: "All Leagues",
          isManager: true,
          paid: true,
          leagueId: "all",
          leagueName: "All Leagues",
        });
      }

      // Per-league admin rows
      
      for (const lid of leagues) {
        const lname = await getLeagueName(lid);
        const row: RosterRow = {
          userId: uid,
          displayName,
          teamId: lid,
          teamName: lname,
          isManager: false,
          paid: true,
        };
        out.push(row);

        (map[uid] ??= []).push({
          teamId: lid,
          teamName: lname,
          isManager: false,
          paid: true,
          leagueId: lid,
          leagueName: lname,
        });
      }

      // If a user is admin but has zero leagues (general org admin), show a neutral row
      if (!claims.superadmin && leagues.length === 0) {
        const row: RosterRow = {
          userId: uid,
          displayName,
          teamId: "org-admin",
          teamName: "Organization Admin",
          isManager: false,
          paid: true,
        };
        out.push(row);
        (map[uid] ??= []).push({
          teamId: "org-admin",
          teamName: "Organization Admin",
          isManager: false,
          paid: true,
          leagueId: "org",
          leagueName: "Organization",
        });
      }
    }
    token = res.pageToken;
  } while (token);

  out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { roster: out, playerTeamsByUser: map };
}