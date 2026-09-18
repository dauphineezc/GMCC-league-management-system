import { db } from "@/db/index";
import { leagues, userPinnedLeagues } from "@/db/schema";
import { resolveLeagueByRef } from "@/lib/db/resolveLeague";
import { and, asc, eq } from "drizzle-orm";

export async function listPinnedLeagueRefs(userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: leagues.slug, id: leagues.id, sortOrder: userPinnedLeagues.sortOrder })
    .from(userPinnedLeagues)
    .innerJoin(leagues, eq(userPinnedLeagues.leagueId, leagues.id))
    .where(eq(userPinnedLeagues.userId, userId))
    .orderBy(asc(userPinnedLeagues.sortOrder), asc(leagues.name));

  return rows.map((r) => r.slug);
}

export async function isLeaguePinned(userId: string, leagueRef: string): Promise<boolean> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return false;
  const [row] = await db
    .select({ userId: userPinnedLeagues.userId })
    .from(userPinnedLeagues)
    .where(
      and(
        eq(userPinnedLeagues.userId, userId),
        eq(userPinnedLeagues.leagueId, league.id)
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function pinLeague(userId: string, leagueRef: string): Promise<boolean> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return false;

  await db
    .insert(userPinnedLeagues)
    .values({ userId, leagueId: league.id })
    .onConflictDoNothing();
  return true;
}

export async function unpinLeague(userId: string, leagueRef: string): Promise<boolean> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return false;

  const deleted = await db
    .delete(userPinnedLeagues)
    .where(
      and(
        eq(userPinnedLeagues.userId, userId),
        eq(userPinnedLeagues.leagueId, league.id)
      )
    )
    .returning({ userId: userPinnedLeagues.userId });
  return deleted.length > 0;
}
