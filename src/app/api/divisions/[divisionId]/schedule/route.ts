// GET league schedule by slug/uuid (authenticated)
// Path kept as /api/divisions/[divisionId]/schedule for back-compat.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDivisionSchedule } from "@/server/schedules";
import { resolveLeagueByRef } from "@/lib/db/resolveLeague";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ divisionId: string }> }
) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;

  const { divisionId } = await params;
  const league = await resolveLeagueByRef(divisionId);
  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const schedule = await getDivisionSchedule(league.slug);
  return NextResponse.json({ schedule });
}
