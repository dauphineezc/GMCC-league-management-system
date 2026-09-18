export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { readDoc } from "@/lib/kvHelpers";
import { getOrCalculateStandings } from "@/lib/leagueData";
import {
  csvAttachment,
  csvDownloadRedirect,
  isLeagueSchedulePdfOnly,
} from "@/lib/adminCsvExport";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = await readDoc<Record<string, any>>(`team:${teamId}`);
  if (!team?.leagueId) {
    return new Response("Team not found", { status: 404 });
  }

  const leagueId = String(team.leagueId);
  const auth = await assertLeagueAdmin(leagueId);
  if (isAuthFailure(auth)) {
    return csvDownloadRedirect(auth.response.status === 401 ? "login" : "denied");
  }

  if (await isLeagueSchedulePdfOnly(leagueId)) {
    return new Response("CSV export unavailable: schedule is PDF-only", { status: 409 });
  }

  const standings = await getOrCalculateStandings(leagueId);
  const rows = standings.map((s) => ({
    teamId: s.teamId,
    teamName: s.teamName,
    wins: s.wins,
    losses: s.losses,
    winPercentage: s.gamesPlayed > 0 ? (s.winPercentage * 100).toFixed(1) : "",
    pointsFor: s.pointsFor,
    pointsAgainst: s.pointsAgainst,
    gamesPlayed: s.gamesPlayed,
  }));

  return csvAttachment(
    `${teamId}-standings`,
    [
      "teamId",
      "teamName",
      "wins",
      "losses",
      "winPercentage",
      "pointsFor",
      "pointsAgainst",
      "gamesPlayed",
    ],
    rows
  );
}
