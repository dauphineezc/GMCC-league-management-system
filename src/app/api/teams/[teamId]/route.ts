// src/app/api/teams/[teamId]/route.ts
import {
  assertLeagueAdmin,
  assertSuperAdmin,
  isAuthFailure,
} from "@/lib/authGuards";
import { deleteTeamById, getTeamById } from "@/lib/repositories/teamsRepo";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  if (!team) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const leagueId =
    typeof team.leagueId === "string" && team.leagueId ? team.leagueId : null;

  // Unassigned teams: only superadmin can delete. Assigned: league admin (or superadmin).
  const auth = leagueId
    ? await assertLeagueAdmin(leagueId)
    : await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const deleted = await deleteTeamById(teamId);
  if (!deleted) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json({ ok: true, deleted: teamId });
}
