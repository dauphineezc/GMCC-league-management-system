export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { getLeagueScheduleView } from "@/lib/leagueData";
import {
  csvAttachment,
  csvDownloadRedirect,
  gameToCsvRow,
  GAME_CSV_HEADERS,
  isLeagueSchedulePdfOnly,
  isScheduleStatus,
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
  const rows = games.filter((g) => isScheduleStatus(g.status)).map(gameToCsvRow);

  return csvAttachment(`${leagueId}-schedule`, GAME_CSV_HEADERS, rows);
}
