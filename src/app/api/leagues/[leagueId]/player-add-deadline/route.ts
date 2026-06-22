// API route for managing player add deadline for a league
import { NextRequest } from "next/server";
import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { readLeagueDocJSON } from "@/lib/leagueDoc";
import { updateLeagueFields } from "@/lib/repositories/leaguesRepo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await assertLeagueAdmin(leagueId);
  if (isAuthFailure(auth)) return auth.response;

  const league = await readLeagueDocJSON(leagueId);
  if (!league) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json({
    playerAddDeadline: league.playerAddDeadline ?? null,
    playerAddDeadlineOverride: league.playerAddDeadlineOverride ?? false,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await assertLeagueAdmin(leagueId);
  if (isAuthFailure(auth)) return auth.response;

  const body = await req.json();
  const { playerAddDeadline, playerAddDeadlineOverride } = body;

  if (playerAddDeadline !== null && playerAddDeadline !== undefined) {
    const date = new Date(playerAddDeadline);
    if (isNaN(date.getTime())) {
      return Response.json({ error: "INVALID_DATE" }, { status: 400 });
    }
  }

  const league = await readLeagueDocJSON(leagueId);
  if (!league) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const updated = await updateLeagueFields(leagueId, {
    playerAddDeadline:
      playerAddDeadline === undefined
        ? undefined
        : playerAddDeadline === null
          ? null
          : new Date(playerAddDeadline),
    playerAddDeadlineOverride,
  });

  if (!updated) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    playerAddDeadline: updated.playerAddDeadline ?? null,
    playerAddDeadlineOverride: updated.playerAddDeadlineOverride ?? false,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await assertLeagueAdmin(leagueId);
  if (isAuthFailure(auth)) return auth.response;

  const league = await readLeagueDocJSON(leagueId);
  if (!league) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await updateLeagueFields(leagueId, {
    playerAddDeadline: null,
    playerAddDeadlineOverride: false,
  });

  return Response.json({ ok: true });
}
