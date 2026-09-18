export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { readDoc } from "@/lib/kvHelpers";
import { getLeagueScheduleView } from "@/lib/leagueData";
import {
  csvAttachment,
  csvDownloadRedirect,
  gameToCsvRow,
  GAME_CSV_HEADERS,
  isHistoryStatus,
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

  const teamName = String(team.name ?? teamId);
  const games = await getLeagueScheduleView(leagueId, teamName);
  const rows = games
    .filter((g) => isHistoryStatus(g.status))
    .map(gameToCsvRow)
    .sort((a, b) => String(b.dateTimeISO).localeCompare(String(a.dateTimeISO)));

  return csvAttachment(`${teamId}-game-history`, GAME_CSV_HEADERS, rows);
}
