// src/lib/adminIndex.ts
import {
  addLeagueAdmin,
  listLeagueRefsForAdminUser,
  removeLeagueAdmin,
} from "@/lib/repositories/leaguesRepo";

/** Tolerant reader: league slugs this admin manages. */
export async function readAdminLeagues(uid: string): Promise<string[]> {
  return listLeagueRefsForAdminUser(uid);
}

/** Legacy no-op — Postgres is already normalized. */
export async function migrateAdminLeaguesToSet(_uid: string): Promise<void> {}

export async function addLeagueToAdmin(uid: string, leagueId: string) {
  await addLeagueAdmin(leagueId, uid);
}

export async function removeLeagueFromAdmin(uid: string, leagueId: string) {
  await removeLeagueAdmin(leagueId, uid);
}

export { listLeagueRefsForAdminUser as readAdminLeagueIds };

/** @deprecated use writeAdminLeaguesAsSet via leaguesRepo if needed */
export async function writeAdminLeaguesAsSet(_uid: string, _leagueIds: string[]) {}
