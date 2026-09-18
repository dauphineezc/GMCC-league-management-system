import { readLeagueGames } from "@/lib/leagueData";
import type { Game } from "@/types/domain";

function toLeagueGame(g: Record<string, unknown>, leagueId: string): Game {
  const statusRaw = String(g.status ?? "scheduled");
  const status: Game["status"] = /final/i.test(statusRaw)
    ? "final"
    : /cancel/i.test(statusRaw)
      ? "canceled"
      : /completed/i.test(statusRaw)
        ? "completed"
        : "scheduled";

  return {
    id: String(g.id),
    leagueId: String(g.leagueId ?? leagueId),
    dateTimeISO: String(g.dateTimeISO ?? g.date ?? g.startTimeISO ?? ""),
    location: String(g.location ?? g.court ?? g.venue ?? ""),
    homeTeamName: String(g.homeTeamName ?? g.homeName ?? ""),
    awayTeamName: String(g.awayTeamName ?? g.awayName ?? ""),
    homeTeamId: g.homeTeamId ? String(g.homeTeamId) : undefined,
    awayTeamId: g.awayTeamId ? String(g.awayTeamId) : undefined,
    status,
    homeScore: g.homeScore != null ? Number(g.homeScore) : undefined,
    awayScore: g.awayScore != null ? Number(g.awayScore) : undefined,
    setScores: Array.isArray(g.setScores)
      ? (g.setScores as Game["setScores"])
      : null,
  };
}

/** Load schedule for a league (slug or uuid). */
export async function getDivisionSchedule(leagueId: string): Promise<Game[]> {
  const rows = await readLeagueGames(leagueId);
  return rows.map((g) => toLeagueGame(g as Record<string, unknown>, leagueId));
}
