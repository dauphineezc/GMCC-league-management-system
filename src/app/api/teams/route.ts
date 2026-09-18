// src/app/api/teams/route.ts
import type { NextRequest } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { resolveLeagueByRef, leaguePublicRef } from "@/lib/db/resolveLeague";
import {
  isKnownDivisionSlug,
  listDivisions,
  slugifyDivisionName,
} from "@/lib/repositories/divisionsRepo";
import { createTeam } from "@/lib/repositories/teamsRepo";

/* ----- request body shape (back-compat + new fields) ----- */
type Body = {
  name?: string;
  description?: string;

  // league identifiers (any may be provided). If all are omitted/empty/null,
  // we treat the team as UNASSIGNED and set leagueId: null.
  leagueId?: string | null;
  division?: string | null;
  divisionId?: string | null;

  // new team classification fields
  sport?: "basketball" | "volleyball";
  gender?: "mens" | "womens" | "co-ed";
  /** Division catalog slug (e.g. low_b). Legacy "low b" forms still accepted. */
  estimatedDivision?: string;
  preferredPracticeDays?: string[]; // ["mon","tue",...]
  teamPaymentRequired?: boolean;
};

const SPORTS = new Set(["basketball", "volleyball"]);
const GENDERS = new Set(["mens", "womens", "co-ed"]);
const DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export async function POST(req: NextRequest) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;
  const userId = auth.user.id;

  const body: Body = await req.json().catch(() => ({} as Body));
  const name = (body.name || "").trim();
  const description = (body.description || "").trim();

  if (!name) {
    return Response.json(
      { error: { code: "BAD_NAME", message: "Team name is required" } },
      { status: 400 }
    );
  }

  const rawLeagueRef =
    (body.leagueId ?? undefined) ??
    (body.division ?? undefined) ??
    (body.divisionId ?? undefined);

  let leagueId: string | null = null;
  let leagueRow: Awaited<ReturnType<typeof resolveLeagueByRef>> = null;
  if (rawLeagueRef != null && String(rawLeagueRef).trim() !== "") {
    const ref = String(rawLeagueRef).trim();
    leagueRow =
      (await resolveLeagueByRef(ref)) ??
      (await resolveLeagueByRef(ref.toLowerCase()));
    if (!leagueRow) {
      return Response.json(
        { error: { code: "BAD_LEAGUE", message: `Unknown league: ${rawLeagueRef}` } },
        { status: 400 }
      );
    }
    leagueId = leaguePublicRef(leagueRow);
  }

  // Prefer league demographics when joining a league at create time.
  let sport = SPORTS.has(String(body.sport))
    ? (body.sport as "basketball" | "volleyball")
    : "basketball";
  let gender = GENDERS.has(String(body.gender))
    ? (body.gender as "mens" | "womens" | "co-ed")
    : "co-ed";
  if (leagueRow) {
    if (SPORTS.has(String(leagueRow.sport))) {
      sport = leagueRow.sport as "basketball" | "volleyball";
    }
    if (GENDERS.has(String(leagueRow.gender))) {
      gender = leagueRow.gender as "mens" | "womens" | "co-ed";
    }
  }

  const divisions = await listDivisions(
    leagueRow ? (leagueRow.sport as string | null) : null
  );
  const requestedDiv = slugifyDivisionName(
    String(
      (leagueRow?.division && String(leagueRow.division).trim()) ||
        body.estimatedDivision ||
        ""
    )
  );
  const estimatedDivision = (await isKnownDivisionSlug(
    requestedDiv,
    leagueRow?.sport ?? null
  ))
    ? requestedDiv
    : (divisions[0]?.slug ?? null);

  if (!estimatedDivision) {
    return Response.json(
      { error: { code: "NO_DIVISIONS", message: "No divisions are configured" } },
      { status: 400 }
    );
  }

  const preferredPracticeDays = Array.isArray(body.preferredPracticeDays)
    ? body.preferredPracticeDays.filter((d) => DAYS.has(String(d))).map(String)
    : [];
  const teamPaymentRequired = Boolean(body.teamPaymentRequired);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const teamDoc = await createTeam({
    id,
    name,
    description,
    leagueSlug: leagueId,
    managerUserId: userId,
    sport,
    gender,
    estimatedDivision,
    paymentRequired: teamPaymentRequired,
  });

  const team = {
    ...teamDoc,
    leagueId,
    managerUserId: userId,
    rosterLimit: 8,
    createdAt: now,
    updatedAt: now,
    preferredPracticeDays,
    teamPaymentRequired,
  };

  return Response.json({ ok: true, team });
}
