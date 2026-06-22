import { db } from "@/db/index";
import { games, teams } from "@/db/schema";
import { resolveLeagueByRef } from "@/lib/db/resolveLeague";
import { findTeamInLeagueByName } from "@/lib/repositories/teamsRepo";
import { and, asc, eq, inArray, isNotNull, lt, or } from "drizzle-orm";

export type GameRow = typeof games.$inferSelect;

export async function listLeagueGamesRaw(leagueRef: string): Promise<GameRow[]> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return [];
  return db
    .select()
    .from(games)
    .where(eq(games.leagueId, league.id))
    .orderBy(asc(games.startsAt));
}

/** Legacy-shaped game objects for existing UI helpers. */
export function gameRowToLegacy(g: GameRow, leagueSlug: string) {
  return {
    id: g.id,
    leagueId: leagueSlug,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    homeTeamName: g.homeTeamName,
    awayTeamName: g.awayTeamName,
    location: g.location,
    dateTimeISO: g.startsAt?.toISOString() ?? null,
    status: g.status,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    createdAt: g.createdAt?.toISOString(),
  };
}

export async function updateGameResult(
  leagueRef: string,
  gameId: string,
  homeScore: number,
  awayScore: number
): Promise<GameRow | null> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return null;

  const rows = await db
    .update(games)
    .set({ homeScore, awayScore, status: "final" })
    .where(and(eq(games.id, gameId), eq(games.leagueId, league.id)))
    .returning();
  return rows[0] ?? null;
}

export async function createScheduledGame(input: {
  leagueRef: string;
  homeTeamName: string;
  awayTeamName: string;
  location: string;
  startsAt: Date;
}): Promise<GameRow | null> {
  const league = await resolveLeagueByRef(input.leagueRef);
  if (!league) return null;

  const homeTeam = await findTeamInLeagueByName(input.leagueRef, input.homeTeamName);
  const awayTeam = await findTeamInLeagueByName(input.leagueRef, input.awayTeamName);

  const rows = await db
    .insert(games)
    .values({
      leagueId: league.id,
      homeTeamId: homeTeam?.id ?? null,
      awayTeamId: awayTeam?.id ?? null,
      homeTeamName: input.homeTeamName.trim(),
      awayTeamName: input.awayTeamName.trim(),
      location: input.location.trim(),
      startsAt: input.startsAt,
      status: "scheduled",
    })
    .returning();
  return rows[0] ?? null;
}

export async function getGameById(
  leagueRef: string,
  gameId: string
): Promise<GameRow | null> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return null;
  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.leagueId, league.id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateScheduledGameDetails(input: {
  leagueRef: string;
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  location: string;
  startsAt: Date;
  status?: "scheduled" | "final" | "canceled";
}): Promise<GameRow | null> {
  const league = await resolveLeagueByRef(input.leagueRef);
  if (!league) return null;

  const existing = await getGameById(input.leagueRef, input.gameId);
  if (!existing) return null;

  const homeTeam = await findTeamInLeagueByName(input.leagueRef, input.homeTeamName);
  const awayTeam = await findTeamInLeagueByName(input.leagueRef, input.awayTeamName);

  const hasResults = existing.homeScore != null && existing.awayScore != null;
  const status = hasResults
    ? "final"
    : (input.status ?? existing.status ?? "scheduled");

  const rows = await db
    .update(games)
    .set({
      homeTeamId: homeTeam?.id ?? null,
      awayTeamId: awayTeam?.id ?? null,
      homeTeamName: input.homeTeamName.trim(),
      awayTeamName: input.awayTeamName.trim(),
      location: input.location.trim(),
      startsAt: input.startsAt,
      status,
    })
    .where(and(eq(games.id, input.gameId), eq(games.leagueId, league.id)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteGame(
  leagueRef: string,
  gameId: string
): Promise<boolean> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return false;
  const rows = await db
    .delete(games)
    .where(and(eq(games.id, gameId), eq(games.leagueId, league.id)))
    .returning({ id: games.id });
  return rows.length > 0;
}

export async function finalizePastGamesWithScores(graceMinutes: number): Promise<number> {
  const cutoff = new Date(Date.now() - graceMinutes * 60_000);
  const rows = await db
    .update(games)
    .set({ status: "final" })
    .where(
      and(
        eq(games.status, "scheduled"),
        lt(games.startsAt, cutoff),
        isNotNull(games.homeScore),
        isNotNull(games.awayScore)
      )
    )
    .returning({ id: games.id });
  return rows.length;
}

export async function listGamesForTeams(teamIds: string[]): Promise<Map<string, GameRow[]>> {
  const map = new Map<string, GameRow[]>();
  if (!teamIds.length) return map;
  for (const id of teamIds) map.set(id, []);

  const rows = await db
    .select()
    .from(games)
    .where(or(inArray(games.homeTeamId, teamIds), inArray(games.awayTeamId, teamIds)))
    .orderBy(asc(games.startsAt));

  for (const g of rows) {
    if (g.homeTeamId && map.has(g.homeTeamId)) map.get(g.homeTeamId)!.push(g);
    if (g.awayTeamId && map.has(g.awayTeamId)) map.get(g.awayTeamId)!.push(g);
  }
  return map;
}

export async function getLeagueTeamsForStandings(leagueRef: string) {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return [];
  return db.select().from(teams).where(eq(teams.leagueId, league.id));
}
