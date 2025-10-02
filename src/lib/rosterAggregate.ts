// /src/lib/rosterAggregate.ts
import { kv } from "@vercel/kv";
import { adminAuth } from "@/lib/firebaseAdmin";
import { DIVISIONS } from "@/lib/divisions";
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

  // Resolve league names up front
  const leagueName = (id: string) => DIVISIONS.find(d => d.id === id)?.name ?? id;

  // walk leagues → teams → team rosters
  for (const leagueId of leagueIds) {
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
          leagueName: leagueName(leagueId),
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
  // We’ll show one row per {admin, league}, and one special row for superadmins.
  const out: RosterRow[] = [];
  const map: Record<string, PlayerTeam[]> = {};

  const leagueName = (id: string) => DIVISIONS.find(d => d.id === id)?.name ?? id;

  let token: string | undefined = undefined;
  do {
    const res = await adminAuth.listUsers(1000, token);
    for (const u of res.users) {
      const claims = (u.customClaims ?? {}) as any;
      const isAdmin = !!claims.superadmin || Array.isArray(claims.leagueAdminOf);
      if (!isAdmin) continue;

      const displayName = u.displayName ?? (u.email ?? u.uid);
      const uid = u.uid;

      // Superadmin row (single “All Leagues” pseudo-membership)
      if (claims.superadmin) {
        const row: RosterRow = {
          userId: uid,
          displayName,
          teamId: "all-leagues",
          teamName: "All Leagues",
          isManager: true,     // renders the “Team Manager” chip; visually matches
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
      const leagues: string[] = Array.isArray(claims.leagueAdminOf) ? claims.leagueAdminOf : [];
      for (const lid of leagues) {
        const row: RosterRow = {
          userId: uid,
          displayName,
          teamId: lid,
          teamName: leagueName(lid),
          isManager: false,
          paid: true,
        };
        out.push(row);

        (map[uid] ??= []).push({
          teamId: lid,
          teamName: leagueName(lid),
          isManager: false,
          paid: true,
          leagueId: lid,
          leagueName: leagueName(lid),
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