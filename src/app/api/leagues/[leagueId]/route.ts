// src/app/api/leagues/[leagueId]/route.ts
import { assertSuperAdmin, isAuthFailure } from "@/lib/authGuards";
import { readDoc } from "@/lib/kvHelpers";
import { deleteLeagueByRef } from "@/lib/repositories/leaguesRepo";

export async function DELETE(
  _req: Request,
  context: { params: { leagueId: string } | Promise<{ leagueId: string }> }
) {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const params = await Promise.resolve(context.params);
  const leagueId = params.leagueId;

  const leagueDoc = await readDoc<Record<string, unknown>>(`league:${leagueId}`);
  if (!leagueDoc) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const deleted = await deleteLeagueByRef(leagueId);
    if (!deleted) {
      return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    return Response.json({ ok: true, deleted: leagueId });
  } catch (error: any) {
    console.error("[DELETE LEAGUE] Error deleting league:", error);
    return Response.json(
      { ok: false, error: error?.message ?? "Failed to delete league" },
      { status: 500 }
    );
  }
}
