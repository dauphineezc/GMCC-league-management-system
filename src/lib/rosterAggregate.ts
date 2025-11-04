// /src/lib/rosterAggregate.ts
import { kv } from "@vercel/kv";
import { adminAuth } from "@/lib/firebaseAdmin";
import { DIVISIONS } from "@/lib/divisions";
import { readLeagueName } from "@/lib/readLeagueName";
import { getAdminDisplayName } from "@/lib/adminUserLookup";
import type { PlayerTeam, RosterRow } from "@/types/domain";


// tolerant helpers (KV values may be strings)
async function smembers(key: string): Promise<string[]> {
    const val = (await kv.smembers(key)) as unknown;
    return Array.isArray(val) ? (val as string[]) : [];
}
async function hgetall<T extends Record<string, any>>(key: string): Promise<T | null> {
    const val = (await kv.hgetall(key)) as unknown;
    return val && typeof val === "object" ? (val as T) : null;
}
  
/** read array from KV (stringified or array) */
async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}

async function readMap<T extends Record<string, any>>(key: string): Promise<T> {
    const raw = await kv.get(key);
    if (!raw) return {} as T;
    if (typeof raw === "string") return JSON.parse(raw) as T;
    return raw as T;
  }

/** read teams from SET and hydrate from team:<id> */
async function getMergedTeams(leagueId: string): Promise<Array<{ teamId: string; name: string; approved?: boolean }>> {
  // teams are now a SET
  const teamIds = await smembers(`league:${leagueId}:teams`);

  const map = new Map<string, { teamId: string; name: string }>();
  for (const id of teamIds) map.set(id, { teamId: id, name: id });

  // If still nothing, infer from players index
  if (map.size === 0) {
    const players = await readArr<any>(`league:${leagueId}:players`);
    for (const id of Array.from(new Set(players.map((p) => p.teamId))).filter(Boolean)) {
      map.set(id, { teamId: id as string, name: id as string });
    }
  }

  const rows: Array<{ teamId: string; name: string; approved?: boolean }> = [];
  await Promise.all(
    Array.from(map.keys()).map(async (id) => {
      const t = (await kv.get<any>(`team:${id}`)) || null;
      rows.push({ teamId: id, name: t?.name ?? map.get(id)!.name, approved: Boolean(t?.approved) });
    })
  );
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Build a global roster (all player memberships) + a mapping for the popup */
export async function buildGlobalPlayerRoster() {
  // Prefer KV index; fall back to static DIVISIONS ids if your seed didn't write the index.
  const indexed = await smembers("leagues:index");
  const leagueIds = indexed.length ? indexed : DIVISIONS.map(d => d.id);

  const roster: RosterRow[] = [];
  const playerTeamsByUser: Record<string, PlayerTeam[]> = {};

  // walk leagues → teams → team rosters
  for (const leagueId of leagueIds) {
    const leagueName = await readLeagueName(leagueId);
    const teams = await getMergedTeams(leagueId);
    for (const t of teams) {
        const [r, payMap] = await Promise.all([
            readArr<any>(`team:${t.teamId}:roster`),
            readMap<Record<string, boolean>>(`team:${t.teamId}:payments`),
        ]);

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
        leaguesFromKV = await smembers(`admin:${uid}:leagues`);
      } catch {
        // Try legacy format
        try {
          const val = await kv.get<any>(`admin:${uid}:leagues`);
          if (Array.isArray(val)) {
            leaguesFromKV = val;
          } else if (typeof val === "string") {
            const arr = JSON.parse(val);
            if (Array.isArray(arr)) leaguesFromKV = arr;
          }
        } catch {}
      }
      
      // Also check email-based key for legacy support
      if (u.email) {
        try {
          const emailLeagues = await smembers(`admin:${u.email}:leagues`);
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