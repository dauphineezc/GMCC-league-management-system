// src/app/api/teams/route.ts
import type { NextRequest } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { normalizeDivision } from "@/lib/divisions";
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
  estimatedDivision?: "low b" | "high b" | "a";
  preferredPracticeDays?: string[]; // ["mon","tue",...]
  teamPaymentRequired?: boolean;
};

const SPORTS = new Set(["basketball", "volleyball"]);
const GENDERS = new Set(["mens", "womens", "co-ed"]);
const DIV_EST = new Set(["low b", "high b", "a"]);
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

  const sport = SPORTS.has(String(body.sport)) ? (body.sport as "basketball" | "volleyball") : "basketball";
  const gender = GENDERS.has(String(body.gender)) ? (body.gender as "mens" | "womens" | "co-ed") : "co-ed";
  const estimatedDivision = DIV_EST.has(String(body.estimatedDivision)) ? (body.estimatedDivision as "low b" | "high b" | "a") : "low b";
  const preferredPracticeDays =
    Array.isArray(body.preferredPracticeDays)
      ? body.preferredPracticeDays.filter((d) => DAYS.has(String(d))).map(String)
      : [];
  const teamPaymentRequired = Boolean(body.teamPaymentRequired);

  const rawDiv =
    (body.leagueId ?? undefined) ??
    (body.division ?? undefined) ??
    (body.divisionId ?? undefined);

  let leagueId: string | null = null;
  if (rawDiv != null && String(rawDiv).trim() !== "") {
    const normalized = normalizeDivision(String(rawDiv));
    if (!normalized) {
      return Response.json(
        { error: { code: "BAD_LEAGUE", message: `Unknown league/division: ${rawDiv}` } },
        { status: 400 }
      );
    }
    leagueId = normalized;
  }

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
