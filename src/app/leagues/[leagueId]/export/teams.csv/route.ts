export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { getTeamsForLeague } from "@/lib/kvHelpers";
import {
  csvAttachment,
  csvDownloadRedirect,
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

  const teams = await getTeamsForLeague(leagueId);
  const rows = teams
    .map((t) => ({
      teamId: t.teamId,
      name: t.name,
      approved: t.approved ? "yes" : "no",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return csvAttachment(`${leagueId}-teams`, ["teamId", "name", "approved"], rows);
}
