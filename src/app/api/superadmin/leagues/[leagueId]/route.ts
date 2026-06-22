// src/app/api/superadmin/leagues/[leagueId]/route.ts
import { assertSuperAdmin, isAuthFailure } from "@/lib/authGuards";
import { deleteLeagueByRef } from "@/lib/repositories/leaguesRepo";
import { getTeamIdsForLeagueRef } from "@/lib/repositories/teamsRepo";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const { leagueId } = await params;
  const teamIds = await getTeamIdsForLeagueRef(leagueId);

  const deleted = await deleteLeagueByRef(leagueId);
  if (!deleted) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json({ ok: true, deleted: leagueId, detachedTeams: teamIds });
}
