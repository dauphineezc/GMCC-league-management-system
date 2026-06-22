import { listAllLeaguesLite, type LeagueDocRecord } from "@/lib/repositories/leaguesRepo";

export type LeagueLite = { id: string; name: string; sport: string };

export async function getLeagues(
  opts: { onlyApproved?: boolean; sport?: "basketball" | "volleyball" } = {}
): Promise<LeagueLite[]> {
  return listAllLeaguesLite({
    onlyApproved: opts.onlyApproved ?? true,
    sport: opts.sport,
  });
}

export type { LeagueDocRecord };
