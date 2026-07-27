import type { DivisionId } from "@/lib/divisions";
import { readLeagueGames } from "@/lib/leagueData";
import type { Game } from "@/types/domain";

function toDivisionGame(g: Record<string, unknown>, divisionId: DivisionId): Game {
  const statusRaw = String(g.status ?? "scheduled");
  const status: Game["status"] = /final/i.test(statusRaw)
    ? "final"
    : /cancel/i.test(statusRaw)
      ? "canceled"
      : "scheduled";

  return {
    id: String(g.id),
    leagueId: String(g.leagueId ?? divisionId),
    dateTimeISO: String(g.dateTimeISO ?? g.date ?? g.startTimeISO ?? ""),
    location: String(g.location ?? g.court ?? g.venue ?? ""),
    homeTeamName: String(g.homeTeamName ?? g.homeName ?? ""),
    awayTeamName: String(g.awayTeamName ?? g.awayName ?? ""),
    homeTeamId: g.homeTeamId ? String(g.homeTeamId) : undefined,
    awayTeamId: g.awayTeamId ? String(g.awayTeamId) : undefined,
    status,
    homeScore: g.homeScore != null ? Number(g.homeScore) : undefined,
    awayScore: g.awayScore != null ? Number(g.awayScore) : undefined,
  };
}

/** Division ids map 1:1 to league slugs; schedule lives in Postgres games. */
export async function getDivisionSchedule(divisionId: DivisionId): Promise<Game[]> {
  const rows = await readLeagueGames(divisionId);
  return rows.map((g) => toDivisionGame(g as Record<string, unknown>, divisionId));
}
