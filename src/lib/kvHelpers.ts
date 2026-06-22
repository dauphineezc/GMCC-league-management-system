import {
  listLeagueSlugs,
  listLeagueRefsForAdminUser,
  listManagedLeagueRefs,
  readLeagueDocByRef,
} from "@/lib/repositories/leaguesRepo";
import {
  batchGetPayments,
  batchGetRosters,
  buildLeagueMasterRoster,
  getTeamById,
  getTeamIdsForLeagueRef,
  getTeamsForLeagueRef,
  listAllTeamIds,
  type MasterRosterRow,
  type TeamCard,
} from "@/lib/repositories/teamsRepo";
import { getUserDoc, readMembershipsForUid } from "@/lib/repositories/usersRepo";

export type { TeamCard, MasterRosterRow };

/** Legacy no-op — index sets are derived from Postgres. */
export async function smembersSafe(key: string): Promise<string[]> {
  if (key === "leagues:index") {
    return listLeagueSlugs({ onlyApproved: false });
  }
  if (key === "teams:index") {
    return listAllTeamIds();
  }

  const leagueTeams = key.match(/^league:(.+):teams$/);
  if (leagueTeams) return getTeamIdsForLeagueRef(leagueTeams[1]);

  const adminKey = key.match(/^admin:(.+):leagues$/);
  if (adminKey) return listLeagueRefsForAdminUser(adminKey[1]);

  return [];
}

export async function readArr<T = unknown>(key: string): Promise<T[]> {
  const teamRoster = key.match(/^team:(.+):roster$/);
  if (teamRoster) {
    const map = await batchGetRosters([teamRoster[1]]);
    return (map.get(teamRoster[1]) ?? []) as T[];
  }

  const userMemberships = key.match(/^user:(.+):memberships$/);
  if (userMemberships) {
    return (await readMembershipsForUid(userMemberships[1])) as T[];
  }

  const leaguePlayers = key.match(/^league:(.+):players$/);
  if (leaguePlayers) {
    const roster = await buildLeagueMasterRoster(leaguePlayers[1]);
    return roster.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      teamId: r.teamId,
      teamName: r.teamName,
      isManager: r.isManager,
      paymentStatus: r.paid ? "PAID" : "UNPAID",
    })) as T[];
  }

  if (key === "league:index") {
    const slugs = await listLeagueSlugs({ onlyApproved: false });
    return slugs.map((id) => ({ id })) as T[];
  }

  return [];
}

export async function readMap<T extends Record<string, unknown> = Record<string, unknown>>(
  key: string
): Promise<T> {
  const teamPayments = key.match(/^team:(.+):payments$/);
  if (teamPayments) {
    const map = await batchGetPayments([teamPayments[1]]);
    return (map.get(teamPayments[1]) ?? {}) as T;
  }
  return {} as T;
}

export async function readDoc<T extends Record<string, unknown> = Record<string, unknown>>(
  key: string
): Promise<T | null> {
  if (key.startsWith("user:") && !key.includes(":memberships")) {
    const uid = key.slice("user:".length);
    return (await getUserDoc(uid)) as T | null;
  }

  if (key.startsWith("team:") && key.indexOf(":", 5) === -1) {
    const teamId = key.slice("team:".length);
    return (await getTeamById(teamId)) as T | null;
  }

  const leagueDoc = key.match(/^league:([^:]+)$/);
  if (leagueDoc) {
    return (await readLeagueDocByRef(leagueDoc[1])) as T | null;
  }

  return null;
}

export async function readLeagueDoc(
  leagueId: string
): Promise<Record<string, unknown> | null> {
  return readLeagueDocByRef(leagueId);
}

export async function getTeamIdsForLeague(leagueId: string): Promise<string[]> {
  return getTeamIdsForLeagueRef(leagueId);
}

export { getTeamsForLeagueRef as getTeamsForLeague };

type AdminUser = {
  id: string;
  email: string | null;
  leagueAdminOf?: string[];
};

export async function resolveManagedLeagueIds(user: AdminUser): Promise<string[]> {
  return listManagedLeagueRefs(user);
}

export async function hasManagedLeagues(user: AdminUser): Promise<boolean> {
  const ids = await resolveManagedLeagueIds(user);
  return ids.length > 0;
}

export { buildLeagueMasterRoster };
