import { resolveLeagueByRef } from "@/lib/db/resolveLeague";
import {
  gameRowToLegacy,
  listLeagueGamesRaw,
  getLeagueTeamsForStandings,
  syncPastGameStatuses,
} from "@/lib/repositories/gamesRepo";
import { batchGetTeamNames } from "@/lib/repositories/teamsRepo";
import { COMPLETION_GRACE_MINUTES } from "@/lib/gameDateTime";
import type { GameSetScore } from "@/db/schema";

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

function normalizeSetScores(raw: unknown): GameSetScore[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const sets: GameSetScore[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const homeScore = Number((item as any).homeScore ?? (item as any).home);
    const awayScore = Number((item as any).awayScore ?? (item as any).away);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
    sets.push({ homeScore, awayScore });
  }
  return sets.length ? sets : null;
}

export function toGameView(g: any, idToName: Map<string, string>) {
  const dateTimeISO = g.dateTimeISO || g.date || g.startTimeISO || g.start || null;
  const location = g.location || g.court || g.venue || "";
  const homeTeamName =
    g.homeTeamName || g.homeName || (g.homeTeamId ? idToName.get(g.homeTeamId) : "") || "";
  const awayTeamName =
    g.awayTeamName || g.awayName || (g.awayTeamId ? idToName.get(g.awayTeamId) : "") || "";

  const setScores = normalizeSetScores(g.setScores);
  const hasResults =
    (setScores != null && setScores.length > 0) ||
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

  // Fallback when DB sync hasn't run yet: treat overdue scheduled games as completed.
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
    setScores,
  };
}

export async function getLeagueScheduleView(leagueId: string, teamFilter = "") {
  // Keep DB statuses aligned before serving schedule/history UIs.
  await syncPastGameStatuses(COMPLETION_GRACE_MINUTES);

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

function emptyStanding(teamId: string, teamName: string): StandingRow {
  return {
    teamId,
    teamName,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    winPercentage: 0,
    gamesPlayed: 0,
  };
}

/** Head-to-head by match score (basketball) or per-game/set wins (volleyball). */
function headToHead(
  finalGames: any[],
  aTeamName: string,
  bTeamName: string,
  volleyball: boolean
): number {
  let aWins = 0;
  let bWins = 0;
  for (const g of finalGames) {
    const involvesA = g.homeTeamName === aTeamName || g.awayTeamName === aTeamName;
    const involvesB = g.homeTeamName === bTeamName || g.awayTeamName === bTeamName;
    if (!involvesA || !involvesB) continue;

    const sets = normalizeSetScores(g.setScores);
    if (volleyball && sets) {
      for (const s of sets) {
        const aScore = g.homeTeamName === aTeamName ? s.homeScore : s.awayScore;
        const bScore = g.homeTeamName === bTeamName ? s.homeScore : s.awayScore;
        if (aScore > bScore) aWins++;
        else if (bScore > aScore) bWins++;
      }
      continue;
    }

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

function applyBasketballMatch(
  homeStanding: StandingRow,
  awayStanding: StandingRow,
  homeScore: number,
  awayScore: number
) {
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
}

/** Volleyball: each set ("game") is a separate W/L; PF/PA sum set points. */
function applyVolleyballMatch(
  homeStanding: StandingRow,
  awayStanding: StandingRow,
  setScores: GameSetScore[]
) {
  for (const s of setScores) {
    homeStanding.pointsFor += s.homeScore;
    homeStanding.pointsAgainst += s.awayScore;
    awayStanding.pointsFor += s.awayScore;
    awayStanding.pointsAgainst += s.homeScore;
    homeStanding.gamesPlayed++;
    awayStanding.gamesPlayed++;

    if (s.homeScore > s.awayScore) {
      homeStanding.wins++;
      awayStanding.losses++;
    } else if (s.awayScore > s.homeScore) {
      awayStanding.wins++;
      homeStanding.losses++;
    }
  }
}

/** Compute standings from final games (no KV persistence). */
export async function calculateStandings(leagueId: string): Promise<StandingRow[]> {
  const league = await resolveLeagueByRef(leagueId);
  const volleyball = (league?.sport || "").toLowerCase() === "volleyball";

  const teams = await getLeagueTeamsForStandings(leagueId);
  const games = await readLeagueGames(leagueId);

  const finalGames = games.filter((game) => {
    const status = (game.status || "").toLowerCase();
    const sets = normalizeSetScores(game.setScores);
    const hasScores =
      (volleyball && sets != null && sets.length === 3) ||
      (game.homeScore != null && game.awayScore != null);
    return (status === "final" || status === "completed") && hasScores;
  });

  const standings: Map<string, StandingRow> = new Map();

  teams.forEach((team) => {
    standings.set(team.name, emptyStanding(team.id, team.name));
  });

  const allTeamNamesInGames = new Set<string>();
  games.forEach((game) => {
    if (game.homeTeamName) allTeamNamesInGames.add(game.homeTeamName);
    if (game.awayTeamName) allTeamNamesInGames.add(game.awayTeamName);
  });

  allTeamNamesInGames.forEach((teamName) => {
    if (!standings.has(teamName)) {
      standings.set(
        teamName,
        emptyStanding(teamName.toLowerCase().replace(/\s+/g, "-"), teamName)
      );
    }
  });

  finalGames.forEach((game) => {
    const homeTeam = game.homeTeamName;
    const awayTeam = game.awayTeamName;
    if (!standings.has(homeTeam) || !standings.has(awayTeam)) return;

    const homeStanding = standings.get(homeTeam)!;
    const awayStanding = standings.get(awayTeam)!;
    const sets = normalizeSetScores(game.setScores);

    if (volleyball && sets && sets.length === 3) {
      applyVolleyballMatch(homeStanding, awayStanding, sets);
      return;
    }

    const homeScore = parseInt(game.homeScore);
    const awayScore = parseInt(game.awayScore);
    if (isNaN(homeScore) || isNaN(awayScore)) return;
    applyBasketballMatch(homeStanding, awayStanding, homeScore, awayScore);
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
    const h2h = headToHead(finalGames, a.teamName, b.teamName, volleyball);
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
