export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
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
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await assertLeagueAdmin(leagueId);
  if (isAuthFailure(auth)) {
    return csvDownloadRedirect(auth.response.status === 401 ? "login" : "denied");
  }

  if (await isLeagueSchedulePdfOnly(leagueId)) {
    return new Response("CSV export unavailable: schedule is PDF-only", { status: 409 });
  }

  const games = await getLeagueScheduleView(leagueId);
  const rows = games
    .filter((g) => isHistoryStatus(g.status))
    .map(gameToCsvRow)
    .sort((a, b) => String(b.dateTimeISO).localeCompare(String(a.dateTimeISO)));

  return csvAttachment(`${leagueId}-game-history`, GAME_CSV_HEADERS, rows);
}
