import { resolveLeagueByRef } from "@/lib/db/resolveLeague";
import {
  gameRowToLegacy,
  listLeagueGamesRaw,
  getLeagueTeamsForStandings,
} from "@/lib/repositories/gamesRepo";
import { batchGetTeamNames } from "@/lib/repositories/teamsRepo";

const COMPLETION_GRACE_MINUTES = 120;

export function parseKVArray<T = any>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}

export async function readLeagueGames(leagueId: string): Promise<any[]> {
  const league = await resolveLeagueByRef(leagueId);
  if (!league) return [];
  const rows = await listLeagueGamesRaw(leagueId);
  return rows.map((g) => gameRowToLegacy(g, league.slug));
}

export function toGameView(g: any, idToName: Map<string, string>) {
  const dateTimeISO = g.dateTimeISO || g.date || g.startTimeISO || g.start || null;
  const location = g.location || g.court || g.venue || "";
  const homeTeamName =
    g.homeTeamName || g.homeName || (g.homeTeamId ? idToName.get(g.homeTeamId) : "") || "";
  const awayTeamName =
    g.awayTeamName || g.awayName || (g.awayTeamId ? idToName.get(g.awayTeamId) : "") || "";

  const hasResults =
    (g.score?.home != null && g.score?.away != null) ||
    (g.homeScore != null && g.awayScore != null);

  const statusRaw = (g.status || "scheduled") + "";
  let status = /final/i.test(statusRaw)
    ? "final"
    : /canceled/i.test(statusRaw)
    ? "canceled"
    : /completed/i.test(statusRaw)
    ? "completed"
    : "scheduled";

  if (status === "scheduled" && !hasResults && dateTimeISO) {
    const start = new Date(dateTimeISO).getTime();
    const now = Date.now();
    if (Number.isFinite(start) && start + COMPLETION_GRACE_MINUTES * 60_000 < now) {
      status = "completed";
    }
  }

  return {
    id: g.id || `game:${g.leagueId || ""}:${dateTimeISO || ""}:${homeTeamName}-${awayTeamName}`,
    leagueId: g.leagueId,
    dateTimeISO,
    location,
    homeTeamName,
    awayTeamName,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    status,
    homeScore: g.score?.home ?? g.homeScore,
    awayScore: g.score?.away ?? g.awayScore,
  };
}

export async function getLeagueScheduleView(leagueId: string, teamFilter = "") {
  const sourceGames = await readLeagueGames(leagueId);

  const teamIds = Array.from(
    new Set(
      sourceGames
        .flatMap((g) => [g.homeTeamId, g.awayTeamId])
        .filter(Boolean) as string[]
    )
  );

  const idToName = await batchGetTeamNames(teamIds);
  const deduped = sourceGames.map((g) => toGameView(g, idToName));

  const filtered = teamFilter
    ? deduped.filter(
        (g) =>
          g.homeTeamName === teamFilter ||
          g.awayTeamName === teamFilter ||
          g.homeTeamId === teamFilter ||
          g.awayTeamId === teamFilter
      )
    : deduped;

  filtered.sort((a, b) => String(a.dateTimeISO).localeCompare(String(b.dateTimeISO)));
  return filtered;
}

export type StandingRow = {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  winPercentage: number;
  gamesPlayed: number;
};

function headToHead(
  finalGames: any[],
  aTeamName: string,
  bTeamName: string
): number {
  let aWins = 0;
  let bWins = 0;
  for (const g of finalGames) {
    const involvesA = g.homeTeamName === aTeamName || g.awayTeamName === aTeamName;
    const involvesB = g.homeTeamName === bTeamName || g.awayTeamName === bTeamName;
    if (!involvesA || !involvesB) continue;

    const aScore =
      g.homeTeamName === aTeamName ? parseInt(g.homeScore) : parseInt(g.awayScore);
    const bScore =
      g.homeTeamName === bTeamName ? parseInt(g.homeScore) : parseInt(g.awayScore);

    if (!Number.isFinite(aScore) || !Number.isFinite(bScore)) continue;
    if (aScore > bScore) aWins++;
    else if (bScore > aScore) bWins++;
  }
  if (aWins !== bWins) return bWins - aWins;
  return 0;
}

/** Compute standings from final games (no KV persistence). */
export async function calculateStandings(leagueId: string): Promise<StandingRow[]> {
  const teams = await getLeagueTeamsForStandings(leagueId);
  const games = await readLeagueGames(leagueId);

  const finalGames = games.filter((game) => {
    const status = (game.status || "").toLowerCase();
    return (
      (status === "final" || status === "completed") &&
      game.homeScore != null &&
      game.awayScore != null
    );
  });

  const standings: Map<string, StandingRow> = new Map();

  teams.forEach((team) => {
    standings.set(team.name, {
      teamId: team.id,
      teamName: team.name,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      winPercentage: 0,
      gamesPlayed: 0,
    });
  });

  const allTeamNamesInGames = new Set<string>();
  games.forEach((game) => {
    if (game.homeTeamName) allTeamNamesInGames.add(game.homeTeamName);
    if (game.awayTeamName) allTeamNamesInGames.add(game.awayTeamName);
  });

  allTeamNamesInGames.forEach((teamName) => {
    if (!standings.has(teamName)) {
      standings.set(teamName, {
        teamId: teamName.toLowerCase().replace(/\s+/g, "-"),
        teamName,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        winPercentage: 0,
        gamesPlayed: 0,
      });
    }
  });

  finalGames.forEach((game) => {
    const homeTeam = game.homeTeamName;
    const awayTeam = game.awayTeamName;
    const homeScore = parseInt(game.homeScore);
    const awayScore = parseInt(game.awayScore);

    if (isNaN(homeScore) || isNaN(awayScore)) return;
    if (!standings.has(homeTeam) || !standings.has(awayTeam)) return;

    const homeStanding = standings.get(homeTeam)!;
    const awayStanding = standings.get(awayTeam)!;

    homeStanding.pointsFor += homeScore;
    homeStanding.pointsAgainst += awayScore;
    awayStanding.pointsFor += awayScore;
    awayStanding.pointsAgainst += homeScore;
    homeStanding.gamesPlayed++;
    awayStanding.gamesPlayed++;

    if (homeScore > awayScore) {
      homeStanding.wins++;
      awayStanding.losses++;
    } else if (awayScore > homeScore) {
      awayStanding.wins++;
      homeStanding.losses++;
    }
  });

  standings.forEach((standing) => {
    const totalGames = standing.wins + standing.losses;
    standing.winPercentage = totalGames > 0 ? standing.wins / totalGames : 0;
  });

  const standingsArray = Array.from(standings.values());
  const teamsWithGames = standingsArray.filter((team) => team.gamesPlayed > 0);
  const teamsWithoutGames = standingsArray.filter((team) => team.gamesPlayed === 0);

  teamsWithGames.sort((a, b) => {
    if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
    if (a.losses !== b.losses) return a.losses - b.losses;
    const h2h = headToHead(finalGames, a.teamName, b.teamName);
    if (h2h !== 0) return h2h;
    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    if (a.pointsAgainst !== b.pointsAgainst) return a.pointsAgainst - b.pointsAgainst;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.teamName.localeCompare(b.teamName);
  });

  teamsWithoutGames.sort((a, b) => a.teamName.localeCompare(b.teamName));
  return [...teamsWithGames, ...teamsWithoutGames];
}

export async function readLeagueStandings(leagueId: string): Promise<StandingRow[]> {
  return calculateStandings(leagueId);
}

export async function getOrCalculateStandings(leagueId: string): Promise<StandingRow[]> {
  return calculateStandings(leagueId);
}
